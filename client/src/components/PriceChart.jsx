import React, { useState, useEffect } from 'react';
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
        padding: '10px 14px',
        boxShadow: isDark
          ? '0 10px 25px rgba(0,0,0,0.6)'
          : '0 10px 25px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(10px)',
        minWidth: '180px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontWeight: 700, color: 'var(--chart-tooltip-text)', fontSize: '0.85rem' }}>
            {data.displayDate}
          </span>
          {data.isBest && (
            <span style={{
              background: 'var(--bg-pill)',
              color: 'var(--text-emerald)',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border-highlight)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              <Star size={10} />
              <span>{isMr ? 'उत्तम' : 'BEST'}</span>
            </span>
          )}
        </div>

        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-emerald)', marginBottom: '3px' }}>
          ₹{data.price.toLocaleString()} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>/ qtl</span>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
          {isMr ? 'कक्षा:' : 'Range:'} ₹{data.minPrice} – ₹{data.maxPrice}
        </div>

        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: 'var(--text-muted)'
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Thermometer size={12} /> {data.temp}
          </span>
          <span>
            {data.rain > 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-blue)' }}>
                <CloudRain size={12} /> {data.rain} mm
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Sun size={12} /> {isMr ? 'कोरडे' : 'Dry'}
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

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkWidth = () => setIsMobile(window.innerWidth < 640);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  if (!dailyForecasts || dailyForecasts.length === 0) return null;

  const chartData = dailyForecasts.map((d) => {
    const dateObj = new Date(d.date);
    const dayLabel = dateObj.toLocaleDateString(isMr ? 'mr-IN' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: isMobile ? undefined : 'short',
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

  const gridStroke = isDark ? 'rgba(154, 171, 136, 0.12)' : 'rgba(115, 139, 93, 0.15)';
  const axisColor = isDark ? '#9aab88' : '#5a7442';
  const lineStroke = isDark ? '#83aa46' : '#41611b';
  const refLabelColor = isDark ? '#b0ce8d' : '#294710';

  return (
    <div style={{ width: '100%', height: isMobile ? '250px' : '310px', marginTop: '12px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{
            top: 15,
            right: isMobile ? 8 : 16,
            left: isMobile ? -18 : -10,
            bottom: 0
          }}
        >
          <defs>
            {/* Price Line Gradient: Cornfield Crop Green #83aa46 & #b0ce8d */}
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineStroke} stopOpacity={isDark ? 0.45 : 0.3} />
              <stop offset="95%" stopColor={lineStroke} stopOpacity={0.0} />
            </linearGradient>

            {/* Range Spread Band: Sky Mist Blue #a9c5dc */}
            <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a9c5dc" stopOpacity={isDark ? 0.22 : 0.2} />
              <stop offset="95%" stopColor="#a9c5dc" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          
          <XAxis
            dataKey="displayDate"
            stroke={axisColor}
            fontSize={isMobile ? 11 : 12}
            tickLine={false}
          />
          <YAxis
            domain={yDomain}
            stroke={axisColor}
            fontSize={isMobile ? 11 : 12}
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
                value: isMr ? 'उत्तम दिवस' : 'Peak Sell',
                fill: refLabelColor,
                fontSize: 11,
                fontWeight: 700,
                position: 'top',
              }}
            />
          )}

          {/* Uncertainty Range Band (Sky Mist) */}
          <Area
            type="monotone"
            dataKey="maxPrice"
            stroke="rgba(169, 197, 220, 0.55)"
            strokeDasharray="2 2"
            fill="url(#rangeGradient)"
            name="Max Range"
          />

          {/* Predicted Modal Price Line (Crop Leaf Green) */}
          <Area
            type="monotone"
            dataKey="price"
            stroke={lineStroke}
            strokeWidth={3}
            fill="url(#priceGradient)"
            name="Predicted Price"
            activeDot={{ r: 6, fill: lineStroke, stroke: isDark ? '#f4f8f1' : '#ffffff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
