import React from 'react';

export default function DayForecastTable({ dailyForecasts, bestSellDate, lang, theme }) {
  const isMr = lang === 'mr';
  const isDark = theme === 'dark';

  if (!dailyForecasts || dailyForecasts.length === 0) return null;

  return (
    <div style={{ marginTop: '24px', overflowX: 'auto' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '12px' }}>
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
          <tr style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <th style={{ padding: '8px 14px' }}>{isMr ? 'तारीख' : 'Date'}</th>
            <th style={{ padding: '8px 14px' }}>{isMr ? 'अपेक्षित भाव' : 'Predicted Price'}</th>
            <th style={{ padding: '8px 14px' }}>{isMr ? 'भाव मर्यादा' : 'Range (Min-Max)'}</th>
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

            const rowBg = isBest
              ? (isDark ? 'rgba(34, 197, 94, 0.14)' : 'rgba(16, 185, 129, 0.1)')
              : 'var(--bg-subtle)';

            const rowBorder = isBest
              ? '1px solid var(--accent-green)'
              : '1px solid var(--border-subtle)';

            return (
              <tr
                key={day.date}
                style={{
                  background: rowBg,
                  border: rowBorder,
                  borderRadius: '10px',
                  transition: 'background 0.15s ease'
                }}
              >
                {/* Date */}
                <td style={{
                  padding: '12px 14px',
                  fontWeight: 600,
                  color: isBest ? 'var(--text-emerald)' : 'var(--text-title)',
                  borderTopLeftRadius: '10px',
                  borderBottomLeftRadius: '10px',
                  whiteSpace: 'nowrap'
                }}>
                  {formattedDate} {idx === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({isMr ? 'आज' : 'Today'})</span>}
                </td>

                {/* Price */}
                <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-title)', whiteSpace: 'nowrap' }}>
                  ₹{Math.round(day.predicted_modal_price).toLocaleString()}
                  {idx > 0 && priceDiff !== 0 && (
                    <span style={{
                      fontSize: '0.72rem',
                      marginLeft: '6px',
                      color: priceDiff > 0 ? 'var(--text-emerald)' : 'var(--text-red)',
                      fontWeight: 700
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


                {/* Action / Badge */}
                <td style={{
                  padding: '12px 14px',
                  borderTopRightRadius: '10px',
                  borderBottomRightRadius: '10px',
                  whiteSpace: 'nowrap'
                }}>
                  {isBest ? (
                    <span style={{
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: 'var(--text-emerald)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-highlight)'
                    }}>
                      ⭐ {isMr ? 'उत्तम भाव (Peak)' : 'Peak Price'}
                    </span>
                  ) : day.weather_risk_flag ? (
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.18)',
                      color: 'var(--text-gold)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(245, 158, 11, 0.35)'
                    }}>
                      ⚠️ {isMr ? 'हवामान सांभाळा' : 'Check Weather'}
                    </span>
                  ) : (
                    <span style={{
                      background: 'var(--bg-pill)',
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
