import React from 'react';
import PriceChart from './PriceChart';
import DayForecastTable from './DayForecastTable';

export default function PriceAdvisoryResult({ result, lang }) {
  const isMr = lang === 'mr';

  if (!result) return null;

  const {
    commodity,
    market,
    district,
    forecast_start_date,
    daily_forecasts = [],
    summary = {},
    farmer_summary = {},
  } = result;

  const {
    best_sell_date,
    best_sell_price,
    price_trend,
    recommendation,
    estimated_earnings_best_day,
    estimated_earnings_today,
    quantity_quintals = 0,
    weather_risk_days = [],
  } = farmer_summary;

  const todayPrice = daily_forecasts[0]?.predicted_modal_price || 0;
  const earningsDiff = (estimated_earnings_best_day || 0) - (estimated_earnings_today || 0);

  const formattedBestDate = best_sell_date
    ? new Date(best_sell_date).toLocaleDateString(isMr ? 'mr-IN' : 'en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      })
    : '';

  // Recommendation theme colors and text
  const isHold = recommendation === 'HOLD_FOR_BEST_PRICE';
  const isSellNow = recommendation === 'SELL_NOW';

  const badgeColor = isHold ? '#22c55e' : isSellNow ? '#ef4444' : '#38bdf8';
  const badgeBg = isHold
    ? 'rgba(34, 197, 94, 0.15)'
    : isSellNow
    ? 'rgba(239, 68, 68, 0.15)'
    : 'rgba(56, 189, 248, 0.15)';
  const badgeBorder = isHold
    ? 'rgba(34, 197, 94, 0.4)'
    : isSellNow
    ? 'rgba(239, 68, 68, 0.4)'
    : 'rgba(56, 189, 248, 0.4)';

  return (
    <div className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner Recommendation */}
      <div
        style={{
          background: badgeBg,
          border: `1.5px solid ${badgeBorder}`,
          borderRadius: '16px',
          padding: '22px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
          boxShadow: isHold ? '0 0 30px rgba(34, 197, 94, 0.15)' : 'none',
        }}
      >
        <div
          style={{
            fontSize: '2.5rem',
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isHold ? '⏳' : isSellNow ? '⚡' : '⚖️'}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <span
              style={{
                background: badgeColor,
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {isHold
                ? isMr ? 'सल्ला: शेतमाल राखून ठेवा' : 'ADVISORY: HOLD FOR PEAK'
                : isSellNow
                ? isMr ? 'सल्ला: आजच विक्री करा' : 'ADVISORY: SELL TODAY'
                : isMr ? 'सल्ला: भाव स्थिर आहे' : 'ADVISORY: STABLE MARKET'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {commodity} • {market} ({district})
            </span>
          </div>

          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
            {isHold
              ? isMr
                ? `${formattedBestDate} पर्यंत थांबा — भाव ₹${Math.round(best_sell_price)}/क्विंटल पर्यंत पोहोचेल!`
                : `Wait until ${formattedBestDate} — Peak rate of ₹${Math.round(best_sell_price)}/qtl expected!`
              : isSellNow
              ? isMr
                ? `आजच विक्री करा (₹${Math.round(todayPrice)}/क्विंटल) — पुढील दिवसांत भाव घसरण्याची शक्यता.`
                : `Sell today at ₹${Math.round(todayPrice)}/qtl — rates expected to soften downstream.`
              : isMr
                ? `भाव स्थिर राहणार आहे — आपल्या सोयीनुसार माल बाजारात न्या.`
                : `Prices are projected to remain steady across the week.`}
          </h3>

          {quantity_quintals > 0 && earningsDiff > 0 && (
            <p style={{ fontSize: '0.92rem', color: 'var(--text-gold)', fontWeight: 600 }}>
              💰 {isMr
                ? `आज विकण्याऐवजी सर्वोत्तम दिवशी विकल्यास ${quantity_quintals} क्विंटलवर अतिरिक्त +₹${Math.round(earningsDiff).toLocaleString()} नफा मिळू शकतो!`
                : `Holding until the peak day can earn you +₹${Math.round(earningsDiff).toLocaleString()} more on your ${quantity_quintals} quintals compared to selling today!`}
            </p>
          )}
        </div>
      </div>

      {/* 4 Stat Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        {/* Card 1: Today's Price */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
            {isMr ? 'आजचा अपेक्षित भाव' : "Today's Rate"}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
            ₹{Math.round(todayPrice).toLocaleString()}
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>/ qtl</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {forecast_start_date}
          </div>
        </div>

        {/* Card 2: Best Selling Rate */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#4ade80', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
            ⭐ {isMr ? 'सर्वोत्तम भाव (Peak)' : 'Peak Rate & Date'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4ade80' }}>
            ₹{Math.round(best_sell_price).toLocaleString()}
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>/ qtl</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#fff', marginTop: '4px', fontWeight: 600 }}>
            {formattedBestDate}
          </div>
        </div>

        {/* Card 3: Total Estimated Earnings */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
            {isMr ? 'एकूण अपेक्षित उत्पन्न' : 'Total Est. Revenue'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>
            ₹{Math.round(estimated_earnings_best_day || (todayPrice * quantity_quintals)).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {quantity_quintals} {isMr ? 'क्विंटल' : 'quintals'} @ Peak Rate
          </div>
        </div>

        {/* Card 4: Extra Gain Difference */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#fbbf24', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
            📈 {isMr ? 'थांबल्यास अतिरिक्त फायदा' : 'Timing Advantage'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>
            {earningsDiff >= 0 ? `+₹${Math.round(earningsDiff).toLocaleString()}` : `₹0`}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {earningsDiff > 0
              ? (isMr ? 'सर्वोत्तम दिवशी विकल्यास फायदा' : 'vs selling immediately today')
              : (isMr ? 'आजच सर्वोत्तम भाव आहे' : 'Peak is today')}
          </div>
        </div>
      </div>

      {/* Weather Risk Notice */}
      {weather_risk_days && weather_risk_days.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '1.5rem' }}>🌧️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.9rem' }}>
              {isMr ? 'हवामान इशारा (Weather Alert): पाऊस शक्यता' : 'Weather Risk Notice: Rain Projected'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isMr
                ? `तारीख: ${weather_risk_days.join(', ')} रोजी पाऊस पडण्याची शक्यता आहे. माल वाहतुकीसाठी बंदिस्त वाहने वापरा किंवा शेतमाल कोरड्या जागी सुरक्षित ठेवा.`
                : `Rain projected on: ${weather_risk_days.join(', ')}. Use waterproof tarpaulins for transport or ensure safe covered storage.`}
            </div>
          </div>
        </div>
      )}

      {/* Forecast Trend Chart */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              📊 {isMr ? '७ ते १४ दिवसांचा भाव आलेख' : 'Price Trend Forecast Chart'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isMr
                ? 'हिरवी रेषा: AI अंदाज भाव • निळा पट्टा: संभाव्य चढ-उतार मर्यादा'
                : 'Green line: Predicted modal price • Blue shade: Expected min-max fluctuation range'}
            </p>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}>
            {price_trend === 'UP' ? '📈 ट्रेंड: वाढता (RISING)' : price_trend === 'DOWN' ? '📉 ट्रेंड: घसरता (FALLING)' : '➡️ ट्रेंड: स्थिर (STABLE)'}
          </div>
        </div>

        <PriceChart dailyForecasts={daily_forecasts} bestSellDate={best_sell_date} lang={lang} />
      </div>

      {/* Day by Day Details Table */}
      <DayForecastTable dailyForecasts={daily_forecasts} bestSellDate={best_sell_date} lang={lang} />

      {/* Model Tech Badge Footer */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        fontSize: '0.75rem',
        color: 'var(--text-muted)'
      }}>
        <div>
          <span>⚙️ AgriSense XGBoost Regressor • 49 Engineered Features (Lags, Rollings, Weather, Lags)</span>
        </div>
        <div>
          <span>APMC: <strong>{market}</strong> ({district}) • Horizon: <strong>{daily_forecasts.length} Days</strong></span>
        </div>
      </div>
    </div>
  );
}
