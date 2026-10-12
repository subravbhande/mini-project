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

export default function PriceChart({ dailyForecasts, bestSellDate, lang }) {
  const isMr = lang === 'mr';

  if (!dailyForecasts || dailyForecasts.length === 0) return null;

  const chartData = dailyForecasts.map((d) => {
    const dateObj = new Date(d.date);
    const dayLabel = dateObj.toLocaleDateString(isMr ? 'mr-IN' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    return {
      date: d.date,
      displayDate: dayLabel,
      price: Math.round(d.predicted_modal_price),
      minPrice: Math.round(d.predicted_min_price),
      maxPrice: Math.round(d.predicted_max_price),
      temp: d.weather?.temp_max_c ? `${d.weather.temp_max_c}°C` : 'N/A',
      rain: d.weather?.precipitation_mm ?? 0,
      rainRisk: d.weather_risk_flag,
      isBest: d.date === bestSellDate,
    };
  });

  const minVal = Math.min(...chartData.map((d) => d.minPrice));
  const maxVal = Math.max(...chartData.map((d) => d.maxPrice));
  const yDomain = [Math.floor((minVal * 0.95) / 50) * 50, Math.ceil((maxVal * 1.05) / 50) * 50];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: data.isBest ? '2px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '12px 16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          minWidth: '200px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>
              {data.displayDate}
            </span>
            {data.isBest && (
              <span style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(34, 197, 94, 0.4)'
              }}>
                ⭐ {isMr ? 'सर्वोत्तम दिवस' : 'BEST DAY'}
              </span>
            )}
          </div>

          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>
            ₹{data.price.toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ qtl</span>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {isMr ? 'अपेक्षित कक्षा:' : 'Expected Range:'} ₹{data.minPrice} – ₹{data.maxPrice}
          </div>

          <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted)'
          }}>
            <span>🌡️ {data.temp}</span>
            <span>
              {data.rain > 0 ? `🌧️ ${data.rain} mm` : '☀️ कोरडे/Dry'}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: '320px', marginTop: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
          
          <XAxis
            dataKey="displayDate"
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            domain={yDomain}
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
            tickFormatter={(val) => `₹${val}`}
          />

          <Tooltip content={<CustomTooltip />} />

          {bestSellDate && (
            <ReferenceLine
              x={chartData.find((d) => d.date === bestSellDate)?.displayDate}
              stroke="#22c55e"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: isMr ? 'सर्वोत्तम विक्री' : 'Best Sell',
                fill: '#4ade80',
                fontSize: 12,
                position: 'top',
              }}
            />
          )}

          {/* Upper Range */}
          <Area
            type="monotone"
            dataKey="maxPrice"
            stroke="rgba(56, 189, 248, 0.4)"
            strokeDasharray="2 2"
            fill="url(#rangeGradient)"
            name="Max Range"
          />

          {/* Predicted Modal Price */}
          <Area
            type="monotone"
            dataKey="price"
            stroke="#10b981"
            strokeWidth={3}
            fill="url(#priceGradient)"
            name="Predicted Price"
            activeDot={{ r: 7, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
