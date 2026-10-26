/**
 * AgriSense — OpenWeatherMap Daily Weather Service
 * Fetches real-time weather and 5-day meteorological forecasts for Kolhapur & Sangli
 * using the configured OpenWeather API key with in-memory caching.
 */

const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');

const fs = require('fs');
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '71b1c519aa7a9dc576127852864819cd';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ML_ROOT = path.join(__dirname, '../../../ml_service');
const defaultVenvPython = path.join(ML_ROOT, 'venv', 'Scripts', 'python.exe');
const PYTHON_PATH = process.env.PYTHON_PATH || (fs.existsSync(defaultVenvPython) ? defaultVenvPython : 'python');

const DISTRICT_COORDS = {
  Kolhapur: { query: 'Kolhapur,IN', lat: 16.7050, lon: 74.2433 },
  Sangli: { query: 'Sangli,IN', lat: 16.8524, lon: 74.5815 },
};

// In-memory cache with 30-minute TTL
const cache = {
  current: {},
  forecast: {},
  lastFetch: {},
};
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Fetch current weather conditions for a district
 */
async function getCurrentWeather(district = 'Kolhapur') {
  const normDist = district.charAt(0).toUpperCase() + district.slice(1).toLowerCase();
  const now = Date.now();

  if (cache.current[normDist] && cache.lastFetch[`current_${normDist}`] && (now - cache.lastFetch[`current_${normDist}`] < CACHE_TTL_MS)) {
    return cache.current[normDist];
  }

  const query = DISTRICT_COORDS[normDist]?.query || `${normDist},IN`;
  try {
    const res = await axios.get(`${BASE_URL}/weather`, {
      params: {
        q: query,
        appid: OPENWEATHER_API_KEY,
        units: 'metric',
      },
      timeout: 10000,
    });

    const d = res.data;
    const result = {
      district: normDist,
      temperature_c: Math.round(d.main.temp * 10) / 10,
      temp_min_c: Math.round(d.main.temp_min * 10) / 10,
      temp_max_c: Math.round(d.main.temp_max * 10) / 10,
      humidity_pct: d.main.humidity,
      precipitation_mm: (d.rain && (d.rain['1h'] || d.rain['3h'])) || 0,
      weather_description: d.weather?.[0]?.description || 'Clear',
      weather_icon: d.weather?.[0]?.icon,
      timestamp: new Date().toISOString(),
    };

    cache.current[normDist] = result;
    cache.lastFetch[`current_${normDist}`] = now;
    return result;
  } catch (err) {
    console.warn(`[WeatherService] Current weather fetch error for ${district}:`, err.message);
    return cache.current[normDist] || {
      district: normDist,
      temperature_c: 26.0,
      humidity_pct: 60.0,
      precipitation_mm: 0.0,
      weather_description: 'Partly Cloudy (fallback)',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Fetch 5-day daily weather forecast compatible with PriceModel & DecayModel
 */
async function get5DayForecast(district = 'Kolhapur') {
  const normDist = district.charAt(0).toUpperCase() + district.slice(1).toLowerCase();
  const now = Date.now();

  if (cache.forecast[normDist] && cache.lastFetch[`forecast_${normDist}`] && (now - cache.lastFetch[`forecast_${normDist}`] < CACHE_TTL_MS)) {
    return cache.forecast[normDist];
  }

  const query = DISTRICT_COORDS[normDist]?.query || `${normDist},IN`;
  try {
    const res = await axios.get(`${BASE_URL}/forecast`, {
      params: {
        q: query,
        appid: OPENWEATHER_API_KEY,
        units: 'metric',
      },
      timeout: 12000,
    });

    const items = res.data.list || [];
    const dailyBuckets = {};

    items.forEach((item) => {
      const day = item.dt_txt.split(' ')[0];
      if (!dailyBuckets[day]) dailyBuckets[day] = [];
      dailyBuckets[day].push(item);
    });

    const dailyForecast = Object.keys(dailyBuckets).sort().slice(0, 5).map((day) => {
      const slice = dailyBuckets[day];
      const temps = slice.map((s) => s.main.temp);
      const humidities = slice.map((s) => s.main.humidity);
      const rains = slice.map((s) => (s.rain && s.rain['3h']) || 0);

      const maxTemp = Math.round(Math.max(...temps) * 10) / 10;
      const minTemp = Math.round(Math.min(...temps) * 10) / 10;
      const avgTemp = Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10;
      const avgHum = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length);
      const totalRain = Math.round(rains.reduce((a, b) => a + b, 0) * 10) / 10;

      const rainRisk = totalRain >= 15.0;
      return {
        date: day,
        district: normDist,
        temp_max_c: maxTemp,
        temp_min_c: minTemp,
        temp_c: avgTemp,
        humidity_pct: avgHum,
        precipitation_mm: totalRain,
        weather_risk_flag: rainRisk,
        weather_risk_reason: rainRisk ? 'High precipitation risk predicted' : 'No adverse weather risk',
      };
    });

    cache.forecast[normDist] = dailyForecast;
    cache.lastFetch[`forecast_${normDist}`] = now;
    return dailyForecast;
  } catch (err) {
    console.warn(`[WeatherService] 5-day forecast fetch error for ${district}:`, err.message);
    return cache.forecast[normDist] || [];
  }
}

/**
 * Execute daily weather ingestion into CSV and MongoDB
 */
async function syncDailyWeather() {
  return new Promise((resolve) => {
    const scriptPath = path.join(ML_ROOT, 'training', 'fetch_daily_weather.py');
    const proc = spawn(PYTHON_PATH, [scriptPath], { cwd: ML_ROOT });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('[WeatherService] Daily weather sync completed successfully.');
        resolve({ success: true, output: stdout });
      } else {
        console.error(`[WeatherService] Daily weather sync failed (code ${code}):`, stderr);
        resolve({ success: false, error: stderr });
      }
    });
  });
}

module.exports = {
  getCurrentWeather,
  get5DayForecast,
  syncDailyWeather,
};
