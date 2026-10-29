import React, { useState, useEffect } from 'react';
import { ClipboardList, Star, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

export default function DayForecastTable({ dailyForecasts, bestSellDate, lang, theme }) {
  const isMr = lang === 'mr';
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkWidth = () => setIsMobile(window.innerWidth < 640);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  if (!dailyForecasts || dailyForecasts.length === 0) return null;

  return (
    <div style={{ marginTop: '22px' }}>
      <h3 style={{
        fontSize: '0.98rem',
        fontWeight: 700,
        color: 'var(--text-title)',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <ClipboardList size={16} color="var(--accent-green)" />
        <span>{isMr ? '१ ते ५ दिवसांचा सविस्तर दर अंदाज' : '1 to 5 Day Detailed Forecast'}</span>
      </h3>

      {/* MOBILE STACKED CARDS VIEW (< 640px) */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
              <div
                key={day.date}
                className="glass-card"
                style={{
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: isBest
                    ? 'var(--bg-subtle)'
                    : 'var(--bg-card)',
                  border: isBest
                    ? '1.5px solid var(--border-highlight)'
                    : '1px solid var(--border-subtle)',
                  boxShadow: isBest ? 'var(--shadow-glow)' : 'none',
                }}
              >
                {/* Top Row: Date & Action Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 800, color: isBest ? 'var(--text-emerald)' : 'var(--text-title)', fontSize: '0.92rem' }}>
                      {formattedDate}
                    </span>
                    {idx === 0 && (
                      <span style={{
                        fontSize: '0.68rem',
                        background: 'var(--bg-pill)',
                        border: '1px solid var(--border-subtle)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        color: 'var(--text-muted)'
                      }}>
                        {isMr ? 'आज' : 'Today'}
                      </span>
                    )}
                  </div>

                  {isBest ? (
                    <span style={{
                      background: 'var(--bg-pill)',
                      color: 'var(--text-emerald)',
                      fontWeight: 800,
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-highlight)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Star size={11} />
                      <span>{isMr ? 'उत्तम भाव (Peak)' : 'Peak Price'}</span>
                    </span>
                  ) : day.weather_risk_flag ? (
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: 'var(--text-gold)',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <AlertTriangle size={11} />
                      <span>{isMr ? 'हवामान सावधगिरी' : 'Weather Risk'}</span>
                    </span>
                  ) : (
                    <span style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.72rem',
                    }}>
                      {isMr ? 'साधारण दिवस' : 'Normal Day'}
                    </span>
                  )}
                </div>

                {/* Middle Row: Price & Delta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-title)' }}>
                      ₹{Math.round(day.predicted_modal_price).toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>/ qtl</span>
                  </div>

                  {idx > 0 && priceDiff !== 0 && (
                    <span style={{
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      color: priceDiff > 0 ? 'var(--text-emerald)' : 'var(--text-red)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      background: 'var(--bg-pill)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}>
                      {priceDiff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {priceDiff > 0 ? `+₹${priceDiff}` : `-₹${Math.abs(priceDiff)}`}
                    </span>
                  )}
                </div>

                {/* Bottom Row: Range */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{isMr ? 'कक्षा:' : 'Range:'} ₹{Math.round(day.predicted_min_price || (day.predicted_modal_price * 0.95))} – ₹{Math.round(day.predicted_max_price || (day.predicted_modal_price * 1.05))}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DESKTOP TABLE VIEW (>= 640px) */
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: '0 6px',
            textAlign: 'left',
            fontSize: '0.85rem'
          }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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

                return (
                  <tr
                    key={day.date}
                    style={{
                      background: isBest
                        ? 'var(--bg-subtle)'
                        : 'var(--bg-card)',
                      border: isBest
                        ? '1px solid var(--border-highlight)'
                        : '1px solid var(--border-subtle)',
                      borderRadius: '10px',
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

                    {/* Action / Badge */}
                    <td style={{
                      padding: '12px 14px',
                      borderTopRightRadius: '10px',
                      borderBottomRightRadius: '10px',
                      whiteSpace: 'nowrap'
                    }}>
                      {isBest ? (
                        <span style={{
                          background: 'var(--bg-pill)',
                          color: 'var(--text-emerald)',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-highlight)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}>
                          <Star size={12} />
                          <span>{isMr ? 'उत्तम भाव (Peak)' : 'Peak Price'}</span>
                        </span>
                      ) : day.weather_risk_flag ? (
                        <span style={{
                          background: 'rgba(245, 158, 11, 0.18)',
                          color: 'var(--text-gold)',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}>
                          <AlertTriangle size={12} />
                          <span>{isMr ? 'हवामान सांभाळा' : 'Check Weather'}</span>
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
      )}
    </div>
  );
}
