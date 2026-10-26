import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Star, Thermometer, CloudRain, Sun } from 'lucide-react';

function ChartTooltip({ active, payload, isMr, theme }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isDark = theme === 'dark';

    return (
      <div style={{
        background: 'var(--chart-tooltip-bg)',
        border: data.isBest
          ? '2px solid var(--accent-green)'
          : '1px solid var(--chart-tooltip-border)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: isDark
          ? '0 10px 25px rgba(0,0,0,0.6)'
          : '0 10px 25px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(10px)',
        minWidth: '200px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, color: 'var(--chart-tooltip-text)', fontSize: '0.9rem' }}>
            {data.displayDate}
          </span>
          {data.isBest && (
            <span style={{
              background: isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(22, 163, 74, 0.15)',
              color: 'var(--text-emerald)',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border-highlight)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Star size={12} />
              <span>{isMr ? 'सर्वोत्तम दिवस' : 'BEST DAY'}</span>
            </span>
          )}
        </div>

        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-blue)', marginBottom: '4px' }}>
          ₹{data.price.toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ qtl</span>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          {isMr ? 'अपेक्षित कक्षा:' : 'Expected Range:'} ₹{data.minPrice} – ₹{data.maxPrice}
        </div>

        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Thermometer size={13} /> {data.temp}
          </span>
          <span>
            {data.rain > 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CloudRain size={13} /> {data.rain} mm
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Sun size={13} /> {isMr ? 'कोरडे' : 'Dry'}
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export default function PriceChart({ dailyForecasts, bestSellDate, lang, theme }) {
  const isMr = lang === 'mr';
  const isDark = theme === 'dark';

  if (!dailyForecasts || dailyForecasts.length === 0) return null;

  const chartData = dailyForecasts.map((d) => {
    const dateObj = new Date(d.date);
    const dayLabel = dateObj.toLocaleDateString(isMr ? 'mr-IN' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    const modal = Number(d.predicted_modal_price) || 0;
    const minP = Number(d.predicted_min_price || d.typical_daily_spread_min || d.confidence_band_low) || (modal * 0.95);
    const maxP = Number(d.predicted_max_price || d.typical_daily_spread_max || d.confidence_band_high) || (modal * 1.05);

    return {
      date: d.date,
      displayDate: dayLabel,
      price: Math.round(modal),
      minPrice: Math.round(minP),
      maxPrice: Math.round(maxP),
      temp: d.weather?.temp_max_c ? `${d.weather.temp_max_c}°C` : 'N/A',
      rain: d.weather?.precipitation_mm ?? 0,
      rainRisk: d.weather_risk_flag,
      isBest: d.date === bestSellDate,
    };
  });

  const minPrices = chartData.map((d) => d.minPrice).filter((v) => !isNaN(v));
  const maxPrices = chartData.map((d) => d.maxPrice).filter((v) => !isNaN(v));
  const minVal = minPrices.length ? Math.min(...minPrices) : 500;
  const maxVal = maxPrices.length ? Math.max(...maxPrices) : 1500;
  const yDomain = [
    Math.max(0, Math.floor((minVal * 0.95) / 50) * 50),
    Math.ceil((maxVal * 1.05) / 50) * 50,
  ];

  const gridStroke = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.07)';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const lineStroke = isDark ? '#10b981' : '#059669';
  const refLabelColor = isDark ? '#4ade80' : '#15803d';

  return (
    <div style={{ width: '100%', height: '320px', marginTop: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineStroke} stopOpacity={isDark ? 0.4 : 0.3} />
              <stop offset="95%" stopColor={lineStroke} stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={isDark ? 0.2 : 0.15} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          
          <XAxis
            dataKey="displayDate"
            stroke={axisColor}
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            domain={yDomain}
            stroke={axisColor}
            fontSize={12}
            tickLine={false}
            tickFormatter={(val) => `₹${val}`}
          />

          <Tooltip content={<ChartTooltip isMr={isMr} theme={theme} />} />

          {bestSellDate && (
            <ReferenceLine
              x={chartData.find((d) => d.date === bestSellDate)?.displayDate}
              stroke="var(--accent-green)"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: isMr ? 'सर्वोत्तम विक्री' : 'Best Sell',
                fill: refLabelColor,
                fontSize: 12,
                fontWeight: 700,
                position: 'top',
              }}
            />
          )}

          {/* Upper Range */}
          <Area
            type="monotone"
            dataKey="maxPrice"
            stroke="rgba(56, 189, 248, 0.45)"
            strokeDasharray="2 2"
            fill="url(#rangeGradient)"
            name="Max Range"
          />

          {/* Predicted Modal Price */}
          <Area
            type="monotone"
            dataKey="price"
            stroke={lineStroke}
            strokeWidth={3}
            fill="url(#priceGradient)"
            name="Predicted Price"
            activeDot={{ r: 7, fill: lineStroke, stroke: isDark ? '#fff' : '#ffffff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
