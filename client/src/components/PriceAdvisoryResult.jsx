import React from 'react';
import PriceChart from './PriceChart';
import DayForecastTable from './DayForecastTable';

export default function PriceAdvisoryResult({ result, lang, theme }) {
  const isMr = lang === 'mr';
  const isDark = theme === 'dark';

  if (!result) return null;

  // Unpack decision fields (from /api/decision/evaluate or ML /decide)
  const decision = result.decision || (result.farmer_summary?.recommendation === 'HOLD_FOR_BEST_PRICE' ? 'HOLD' : 'SELL');
  const actByDate = result.act_by_date || result.farmer_summary?.best_sell_date || '';
  const reasonText = isMr
    ? (result.reason_mr || result.reason || '')
    : (result.reason || result.reason_mr || '');

  const nrvToday = result.nrv_today ?? (result.farmer_summary?.estimated_earnings_today || 0);
  const nrvBest = result.nrv_best ?? (result.farmer_summary?.estimated_earnings_best_day || 0);

  // Parse and calculate net economic uplift as a clean percentage (not ratio), up to 2 decimal places
  let rawUplift = result.uplift_pct;
  if (rawUplift === undefined || rawUplift === null) {
    rawUplift = result.economic_decision?.uplift_pct;
  }
  if (rawUplift === undefined || rawUplift === null) {
    rawUplift = nrvToday > 0 ? ((nrvBest - nrvToday) / nrvToday) * 100 : 0;
  }

  let numUplift = Number(rawUplift) || 0;
  // If the value is a ratio (|val| < 1 and non-zero, e.g. 0.16 or 0.0476), convert it to percentage (e.g. 0.16 -> 16.00%)
  if (Math.abs(numUplift) > 0 && Math.abs(numUplift) < 1) {
    numUplift = numUplift * 100;
  }

  const upliftPct = numUplift;
  const upliftSign = upliftPct > 0 ? '+' : '';
  const formattedUplift = `${upliftSign}${upliftPct.toFixed(2)}%`;

  const confidenceLabel = result.confidence_label || 'Moderate';
  const breakEvenPrice = result.break_even_price_best_day || 0;
  const breakEvenPct = result.break_even_pct_best_day || 0;

  // Data freshness
  const isStale = Boolean(result.stale);
  const dataAsOf = result.data_as_of || '';
  const daysStale = result.days_stale || 0;

  // Unpack forecast data
  const commodity = result.commodity || '';
  const market = result.market || '';
  const district = result.district || '';
  const priceForecast = result.price_forecast || result;
  const dailyForecasts = priceForecast.daily_forecasts || [];
  const farmerSummary = priceForecast.farmer_summary || result.farmer_summary || {};

  const todayPrice = dailyForecasts[0]?.predicted_modal_price || 0;

  // Theme styling based on true decision
  const isHold = decision === 'HOLD';
  const isPartial = decision === 'PARTIAL_SELL';
  const isSell = decision === 'SELL';

  const badgeColor = isHold ? '#10b981' : isPartial ? '#f59e0b' : '#ef4444';
  const badgeBg = isHold
    ? (isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)')
    : isPartial
      ? (isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.12)')
      : (isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)');

  const badgeBorder = isHold
    ? (isDark ? 'rgba(16, 185, 129, 0.45)' : 'rgba(16, 185, 129, 0.4)')
    : isPartial
      ? (isDark ? 'rgba(245, 158, 11, 0.45)' : 'rgba(245, 158, 11, 0.4)')
      : (isDark ? 'rgba(239, 68, 68, 0.45)' : 'rgba(239, 68, 68, 0.4)');

  const formattedActBy = actByDate
    ? new Date(actByDate).toLocaleDateString(isMr ? 'mr-IN' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    : '';

  return (
    <div className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Staleness Warning Banner if data is aged */}
      {isStale && (
        <div style={{
          background: isDark ? 'rgba(234, 179, 8, 0.12)' : 'rgba(245, 158, 11, 0.12)',
          border: `1px solid ${isDark ? 'rgba(234, 179, 8, 0.35)' : 'rgba(217, 119, 6, 0.35)'}`,
          borderRadius: '12px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.85rem',
          color: 'var(--text-title)'
        }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>
            <strong style={{ color: 'var(--text-gold)' }}>{isMr ? 'बाजार माहिती सावधगिरी:' : 'Market Data Notice:'}</strong>{' '}
            <span style={{ color: 'var(--text-body)' }}>
              {isMr
                ? `शेवटची अधिकृत मंडी नोंद ${dataAsOf} रोजीची आहे (${daysStale} दिवस जुनी). AI मॉडेलने अनिश्चितता पट्टा रुंद केला आहे.`
                : `Latest official APMC report date is ${dataAsOf} (${daysStale} days old). Uncertainty bands have been widened accordingly.`}
            </span>
          </div>
        </div>
      )}

      {/* Top Banner Decision */}
      <div
        style={{
          background: badgeBg,
          border: `1.5px solid ${badgeBorder}`,
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '18px',
          boxShadow: isHold
            ? (isDark ? '0 0 30px rgba(34, 197, 94, 0.18)' : '0 6px 20px rgba(16, 185, 129, 0.15)')
            : 'none',
          transition: 'all 0.25s ease',
        }}
      >
        <div
          style={{
            fontSize: '2.5rem',
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.8)',
            border: `1px solid ${varToString('--border-subtle')}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'var(--shadow-toggle)'
          }}
        >
          {isHold ? '⏳' : isPartial ? '⚖️' : '⚡'}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span
              style={{
                background: badgeColor,
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                boxShadow: `0 2px 8px ${badgeColor}40`
              }}
            >
              {isHold
                ? isMr ? 'सल्ला: शेतमाल राखून ठेवा (HOLD)' : 'ADVISORY: HOLD PRODUCE'
                : isPartial
                  ? isMr ? 'सल्ला: अर्धा विका / अर्धा ठेवा (PARTIAL-SELL)' : 'ADVISORY: PARTIAL-SELL (50%)'
                  : isMr ? 'सल्ला: आजच विक्री करा (SELL TODAY)' : 'ADVISORY: SELL TODAY'}
            </span>

            <span style={{
              background: 'var(--bg-pill)',
              border: '1px solid var(--border-subtle)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}>
              {isMr ? 'विश्वासार्हता:' : 'Confidence:'} <strong style={{ color: 'var(--text-title)' }}>{confidenceLabel}</strong>
            </span>

            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {commodity} • {market} ({district})
            </span>
          </div>

          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '8px', lineHeight: 1.3 }}>
            {reasonText || (isSell ? (isMr ? 'आजच विक्री करणे फायदेशीर आहे.' : 'Selling today maximizes returns.') : '')}
          </h3>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-body)' }}>
            📅 <strong>{isMr ? 'कारवाईची अंतिम तारीख (Act By):' : 'Act-By Date:'}</strong>{' '}
            <span style={{ color: 'var(--text-title)', fontWeight: 700 }}>
              {formattedActBy || actByDate || (isMr ? 'आजच' : 'Today')}
            </span>
          </div>
        </div>
      </div>

      {/* Break-Even Insight Box */}
      <div style={{
        background: 'var(--bg-subtle)',
        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.25)'}`,
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontSize: '0.88rem'
      }}>
        <span style={{ fontSize: '1.6rem' }}>🎯</span>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-blue)', marginBottom: '2px' }}>
            {isMr ? 'ब्रेक-इव्हन विश्लेषण (Break-Even Requirement)' : 'Holding Break-Even Threshold'}
          </div>
          <div style={{ color: 'var(--text-muted)', lineHeight: '1.45' }}>
            {isMr ? (
              <>
                साठवणुकीचा खर्च आणि नैसर्गिक घट भरून काढण्यासाठी बाजारभाव किमान{' '}
                <strong style={{ color: 'var(--text-title)' }}>+{Math.max(0, Math.round(breakEvenPct))}% (₹{Math.round(breakEvenPrice)}/क्विंटल)</strong>{' '}
                वाढणे गरजेचे आहे. जर भावात इतकी वाढ शक्य नसेल तर आजच विकणे अधिक सुरक्षित ठरेल.
              </>
            ) : (
              <>
                To justify holding produce against storage fees and deterioration, mandi prices must rise by at least{' '}
                <strong style={{ color: 'var(--text-title)' }}>+{Math.max(0, Math.round(breakEvenPct))}% (₹{Math.round(breakEvenPrice)}/qtl)</strong>{' '}
                to break even.
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4 Financial Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        {/* Card 1: Today's Price */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
            {isMr ? 'आजचा मंडी भाव' : "Today's Mandi Rate"}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-title)' }}>
            ₹{Math.round(todayPrice).toLocaleString()}
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>/ qtl</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {dataAsOf ? `${isMr ? 'नोंद दिनांक:' : 'Data date:'} ${dataAsOf}` : ''}
          </div>
        </div>

        {/* Card 2: Today's Net Realizable Value */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
            {isMr ? 'आज विकल्यास निव्वळ रक्कम' : 'NRV Selling Today'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-blue)' }}>
            ₹{Math.round(nrvToday).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isMr ? 'सध्याची प्रत आणि घट लक्षात घेऊन' : 'Net of current quality & transport'}
          </div>
        </div>

        {/* Card 3: Best Projected Value */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.35)' : 'rgba(16, 185, 129, 0.4)'}`,
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-emerald)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
            ⭐ {isMr ? 'सर्वोत्तम निव्वळ उत्पन्न' : 'Best Projected NRV'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-emerald)' }}>
            ₹{Math.round(nrvBest).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-body)', marginTop: '4px', fontWeight: 600 }}>
            {formattedActBy || actByDate}
          </div>
        </div>

        {/* Card 4: Net Uplift % */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.35)'}`,
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-gold)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
            📈 {isMr ? 'अपेक्षित निव्वळ नफा/तोटा' : 'Net Economic Uplift'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: upliftPct > 0 ? 'var(--text-emerald)' : (upliftPct < 0 ? 'var(--text-red)' : 'var(--text-title)') }}>
            {formattedUplift}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {upliftPct > 0
              ? (isMr ? 'थांबल्यास अतिरिक्त फायदा' : 'holding advantage')
              : (isMr ? 'आजच विकणे श्रेयस्कर' : 'selling today optimal')}
          </div>
        </div>
      </div>

      {/* Forecast Trend Chart */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-title)' }}>
              📊 {isMr ? '१ ते ५ दिवसांचा भाव अंदाज व अनिश्चितता पट्टा' : '1 to 5 Day Price Forecast & Uncertainty Bands'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isMr
                ? 'हिरवी रेषा: AI अंदाज भाव • शेडेड पट्टा: empirical residual uncertainty band'
                : 'Green line: Model forecast • Shaded band: Empirical residual error band'}
            </p>
          </div>
        </div>

        <PriceChart dailyForecasts={dailyForecasts} bestSellDate={actByDate} lang={lang} theme={theme} />
      </div>

      {/* Day by Day Details Table */}
      <DayForecastTable dailyForecasts={dailyForecasts} bestSellDate={actByDate} lang={lang} theme={theme} />

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
          <span>APMC: <strong style={{ color: 'var(--text-title)' }}>{market}</strong> ({district}) • Horizon: <strong style={{ color: 'var(--text-title)' }}>{dailyForecasts.length} Days</strong></span>
        </div>
      </div>
    </div>
  );
}

function varToString(v) {
  return `var(${v})`;
}
