import React from 'react';

export default function DayForecastTable({ dailyForecasts, bestSellDate, lang }) {
  const isMr = lang === 'mr';

  if (!dailyForecasts || dailyForecasts.length === 0) return null;

  return (
    <div style={{ marginTop: '24px', overflowX: 'auto' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
        📋 {isMr ? 'दैनंदिन अंदाज व तपशील (Daily Breakdown)' : 'Daily Price & Weather Breakdown'}
      </h3>

      <table style={{
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: '0 6px',
        textAlign: 'left',
        fontSize: '0.85rem'
      }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
            <th style={{ padding: '8px 14px' }}>{isMr ? 'तारीख' : 'Date'}</th>
            <th style={{ padding: '8px 14px' }}>{isMr ? 'अपेक्षित भाव' : 'Predicted Price'}</th>
            <th style={{ padding: '8px 14px' }}>{isMr ? 'भाव मर्यादा' : 'Range (Min-Max)'}</th>
            <th style={{ padding: '8px 14px' }}>{isMr ? 'हवामान' : 'Weather'}</th>
            <th style={{ padding: '8px 14px' }}>{isMr ? 'सल्ला' : 'Action'}</th>
          </tr>
        </thead>
        <tbody>
          {dailyForecasts.map((day, idx) => {
            const dateObj = new Date(day.date);
            const isBest = day.date === bestSellDate;
            const formattedDate = dateObj.toLocaleDateString(isMr ? 'mr-IN' : 'en-US', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });
            const prevPrice = idx > 0 ? dailyForecasts[idx - 1].predicted_modal_price : day.predicted_modal_price;
            const priceDiff = Math.round(day.predicted_modal_price - prevPrice);

            return (
              <tr
                key={day.date}
                style={{
                  background: isBest ? 'rgba(34, 197, 94, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                  border: isBest ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  transition: 'background 0.15s'
                }}
              >
                {/* Date */}
                <td style={{
                  padding: '12px 14px',
                  fontWeight: 600,
                  color: isBest ? '#4ade80' : '#fff',
                  borderTopLeftRadius: '10px',
                  borderBottomLeftRadius: '10px',
                  whiteSpace: 'nowrap'
                }}>
                  {formattedDate} {idx === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({isMr ? 'आज' : 'Today'})</span>}
                </td>

                {/* Price */}
                <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: '0.95rem', color: '#fff', whiteSpace: 'nowrap' }}>
                  ₹{Math.round(day.predicted_modal_price).toLocaleString()}
                  {idx > 0 && priceDiff !== 0 && (
                    <span style={{
                      fontSize: '0.72rem',
                      marginLeft: '6px',
                      color: priceDiff > 0 ? '#4ade80' : '#f87171',
                      fontWeight: 600
                    }}>
                      {priceDiff > 0 ? `+₹${priceDiff}` : `-₹${Math.abs(priceDiff)}`}
                    </span>
                  )}
                </td>

                {/* Range */}
                <td style={{ padding: '12px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  ₹{Math.round(day.predicted_min_price || (day.predicted_modal_price * 0.95))} – ₹{Math.round(day.predicted_max_price || (day.predicted_modal_price * 1.05))}
                </td>

                {/* Weather */}
                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🌡️ {day.weather?.temp_max_c ? `${day.weather.temp_max_c}°C` : 'N/A'}</span>
                    {day.weather_risk_flag ? (
                      <span style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        🌧️ {isMr ? 'पाऊस धोका' : 'Rain Risk'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>☀️</span>
                    )}
                  </div>
                </td>

                {/* Action / Badge */}
                <td style={{
                  padding: '12px 14px',
                  borderTopRightRadius: '10px',
                  borderBottomRightRadius: '10px',
                  whiteSpace: 'nowrap'
                }}>
                  {isBest ? (
                    <span style={{
                      background: 'rgba(34, 197, 94, 0.25)',
                      color: '#4ade80',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(34, 197, 94, 0.5)'
                    }}>
                      ⭐ {isMr ? 'उत्तम भाव (Peak)' : 'Peak Price'}
                    </span>
                  ) : day.weather_risk_flag ? (
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: '6px'
                    }}>
                      ⚠️ {isMr ? 'हवामान सांभाळा' : 'Check Weather'}
                    </span>
                  ) : (
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: '6px'
                    }}>
                      {isMr ? 'साधारण दिवस' : 'Regular Day'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
