import React, { useState } from 'react';
import PriceChart from './PriceChart';
import DayForecastTable from './DayForecastTable';
import { useAuth } from '../context/AuthContext';
import { createBatchApi } from '../services/priceApi';
import {
  AlertTriangle,
  Clock,
  Scale,
  Zap,
  Calendar,
  Target,
  Star,
  TrendingUp,
  BarChart3,
  Pin,
  Check,
  Save,
  Lock,
} from 'lucide-react';

export default function PriceAdvisoryResult({ result, formData, lang, theme, onOpenAuthModal, onBatchSaved }) {
  const { isAuthenticated } = useAuth();
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const isMr = lang === 'mr';
  const isDark = theme === 'dark';

  if (!result) return null;

  // Unpack forecast data safely before handlers
  const commodity = result.commodity || formData?.commodity || 'Tomato';
  const market = result.market || formData?.market || 'Kolhapur';
  const district = result.district || formData?.district || 'Kolhapur';

  const handleSaveBatch = async () => {
    if (!isAuthenticated) {
      if (onOpenAuthModal) onOpenAuthModal('login');
      return;
    }
    setSaveLoading(true);
    setSaveError('');
    try {
      const q = result.quantity_quintals || result.quantityQuintals || formData?.quantity_quintals || 50;
      const st = result.storage_type || result.storageType || formData?.storage_type || 'ambient';
      const ln = result.liquidity_need || result.liquidityNeed || formData?.liquidity_need || 'normal';

      await createBatchApi({
        commodity,
        district,
        market,
        variety: 'Standard',
        quantityQuintals: Number(q),
        storageType: st,
        liquidityNeed: ln,
      });
      setSaveSuccess(true);
      if (onBatchSaved) onBatchSaved();
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      setSaveError(err.response?.data?.message || err.message || 'Failed to save batch');
    } finally {
      setSaveLoading(false);
    }
  };

  // Unpack decision fields
  const decision = result.decision || (result.farmer_summary?.recommendation === 'HOLD_FOR_BEST_PRICE' ? 'HOLD' : 'SELL');
  const actByDate = result.act_by_date || result.farmer_summary?.best_sell_date || '';
  const reasonText = isMr
    ? (result.reason_mr || result.reason || '')
    : (result.reason || result.reason_mr || '');

  const nrvToday = result.nrv_today ?? (result.farmer_summary?.estimated_earnings_today || 0);
  const nrvBest = result.nrv_best ?? (result.farmer_summary?.estimated_earnings_best_day || 0);

  let rawUplift = result.uplift_pct;
  if (rawUplift === undefined || rawUplift === null) {
    rawUplift = result.economic_decision?.uplift_pct;
  }
  if (rawUplift === undefined || rawUplift === null) {
    rawUplift = nrvToday > 0 ? ((nrvBest - nrvToday) / nrvToday) * 100 : 0;
  }

  let numUplift = Number(rawUplift) || 0;
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

  // Forecast sub-objects
  const priceForecast = result.price_forecast || result;
  const dailyForecasts = priceForecast.daily_forecasts || [];
  const todayPrice = dailyForecasts[0]?.predicted_modal_price || 0;

  // Decision themes
  const isHold = decision === 'HOLD';
  const isPartial = decision === 'PARTIAL_SELL';
  const isSell = decision === 'SELL';

  const badgeColor = isHold ? 'var(--accent-green)' : isPartial ? 'var(--accent-amber)' : 'var(--accent-red)';
  const badgeBg = isHold
    ? (isDark ? 'rgba(74, 222, 128, 0.08)' : 'rgba(65, 97, 27, 0.08)')
    : isPartial
      ? (isDark ? 'rgba(245, 158, 11, 0.09)' : 'rgba(245, 158, 11, 0.08)')
      : (isDark ? 'rgba(239, 68, 68, 0.09)' : 'rgba(239, 68, 68, 0.08)');

  const badgeBorder = isHold
    ? (isDark ? 'rgba(74, 222, 128, 0.3)' : 'rgba(65, 97, 27, 0.35)')
    : isPartial
      ? (isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.35)')
      : (isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.35)');

  const formattedActBy = actByDate
    ? new Date(actByDate).toLocaleDateString(isMr ? 'mr-IN' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    : '';

  return (
    <div className="glass-card" style={{ padding: 'clamp(16px, 4vw, 26px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Staleness Warning Banner */}
      {isStale && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.82rem',
          color: 'var(--text-title)'
        }}>
          <AlertTriangle size={18} color="var(--text-gold)" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--text-gold)' }}>{isMr ? 'बाजार माहिती सावधगिरी:' : 'Notice:'}</strong>{' '}
            <span style={{ color: 'var(--text-body)' }}>
              {isMr
                ? `शेवटची अधिकृत मंडी नोंद ${dataAsOf} रोजीची आहे (${daysStale} दिवस जुनी).`
                : `Latest official APMC report date is ${dataAsOf} (${daysStale} days old).`}
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
          padding: 'clamp(14px, 3.5vw, 22px)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: '16px',
          boxShadow: isHold ? 'var(--shadow-glow)' : 'none',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'var(--shadow-toggle)'
          }}
        >
          {isHold ? <Clock size={26} color="var(--text-emerald)" /> : isPartial ? <Scale size={26} color="var(--text-gold)" /> : <Zap size={26} color="var(--accent-red)" />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span
              style={{
                background: badgeColor,
                color: '#ffffff',
                fontSize: '0.76rem',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {isHold
                ? isMr ? 'सल्ला: माल राखून ठेवा (HOLD)' : 'ADVISORY: HOLD PRODUCE'
                : isPartial
                  ? isMr ? 'सल्ला: अर्धा विका / ठेवा (PARTIAL-SELL)' : 'ADVISORY: PARTIAL-SELL'
                  : isMr ? 'सल्ला: आजच विक्री करा (SELL TODAY)' : 'ADVISORY: SELL TODAY'}
            </span>

            <span style={{
              background: 'var(--bg-pill)',
              border: '1px solid var(--border-subtle)',
              padding: '2px 7px',
              borderRadius: '6px',
              fontSize: '0.74rem',
              color: 'var(--text-muted)'
            }}>
              {isMr ? 'विश्वास:' : 'Conf:'} <strong style={{ color: 'var(--text-title)' }}>{confidenceLabel}</strong>
            </span>

            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {commodity} • {market}
            </span>
          </div>

          <h3 style={{ fontSize: 'clamp(1.05rem, 3.5vw, 1.25rem)', fontWeight: 800, color: 'var(--text-title)', marginBottom: '8px', lineHeight: 1.35 }}>
            {reasonText || (isSell ? (isMr ? 'आजच विक्री करणे फायदेशीर आहे.' : 'Selling today maximizes returns.') : '')}
          </h3>

          <div style={{ fontSize: '0.86rem', color: 'var(--text-body)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <Calendar size={15} color="var(--text-emerald)" />
            <span><strong>{isMr ? 'अंतिम तारीख (Act By):' : 'Act-By Date:'}</strong></span>
            <span style={{ color: 'var(--text-title)', fontWeight: 800 }}>
              {formattedActBy || actByDate || (isMr ? 'आजच' : 'Today')}
            </span>
          </div>
        </div>
      </div>

      {/* Break-Even Insight Box */}
      <div style={{
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-highlight)',
        borderRadius: '14px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.85rem'
      }}>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '10px',
          background: 'var(--bg-pill)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Target size={20} color="var(--text-emerald)" />
        </div>
        <div>
          <div style={{ fontWeight: 800, color: 'var(--text-emerald)', marginBottom: '2px' }}>
            {isMr ? 'ब्रेक-इव्हन मर्यादा (Break-Even)' : 'Holding Break-Even Threshold'}
          </div>
          <div style={{ color: 'var(--text-muted)', lineHeight: '1.45', fontSize: '0.82rem' }}>
            {isMr ? (
              <>
                साठवणूक खर्च व घट भरून काढण्यासाठी बाजारभाव किमान{' '}
                <strong style={{ color: 'var(--text-title)' }}>+{Math.max(0, Math.round(breakEvenPct))}% (₹{Math.round(breakEvenPrice)}/क्विंटल)</strong>{' '}
                वाढणे आवश्यक आहे.
              </>
            ) : (
              <>
                Mandi rates must rise by at least{' '}
                <strong style={{ color: 'var(--text-title)' }}>+{Math.max(0, Math.round(breakEvenPct))}% (₹{Math.round(breakEvenPrice)}/qtl)</strong>{' '}
                to justify holding against weight loss and storage fees.
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4 Financial Metric Cards (Responsive 2x2 grid on mobile, 4-col on desktop) */}
      <div className="metric-grid">
        {/* Card 1: Today's Price */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '14px'
        }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
            {isMr ? 'आजचा मंडी भाव' : "Today's Rate"}
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-title)' }}>
            ₹{Math.round(todayPrice).toLocaleString()}
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '3px' }}>/qtl</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {dataAsOf ? `${dataAsOf}` : ''}
          </div>
        </div>

        {/* Card 2: Today's Net Realizable Value */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '14px'
        }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
            {isMr ? 'आज विकल्यास निव्वळ' : 'NRV Today'}
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-blue)' }}>
            ₹{Math.round(nrvToday).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isMr ? 'सध्याची प्रत व घट' : 'Immediate net'}
          </div>
        </div>

        {/* Card 3: Best Projected Value */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-highlight)',
          borderRadius: '14px',
          padding: '14px'
        }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-emerald)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Star size={13} /> {isMr ? 'सर्वोत्तम निव्वळ' : 'Best NRV'}
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-emerald)' }}>
            ₹{Math.round(nrvBest).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-body)', marginTop: '4px', fontWeight: 600 }}>
            {formattedActBy || actByDate}
          </div>
        </div>

        {/* Card 4: Net Uplift % */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '14px',
          padding: '14px'
        }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-gold)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={13} /> {isMr ? 'अपेक्षित नफा' : 'Net Uplift'}
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: upliftPct > 0 ? 'var(--text-emerald)' : (upliftPct < 0 ? 'var(--text-red)' : 'var(--text-title)') }}>
            {formattedUplift}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {upliftPct > 0
              ? (isMr ? 'थांबल्यास फायदा' : 'Holding benefit')
              : (isMr ? 'आज विकणे योग्य' : 'Sell today')}
          </div>
        </div>
      </div>

      {/* Forecast Trend Chart & Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
          <div>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={17} color="var(--accent-green)" />
              <span>{isMr ? '१ ते ५ दिवसांचा अंदाज व अनिश्चितता पट्टा' : '1 to 5 Day Forecast & Error Bands'}</span>
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {isMr
                ? 'हिरवी रेषा: AI अंदाज • निळा पट्टा: संभाव्य अनिश्चितता'
                : 'Green line: AI forecast • Blue band: Empirical uncertainty'}
            </p>
          </div>
        </div>

        <PriceChart dailyForecasts={dailyForecasts} bestSellDate={actByDate} lang={lang} theme={theme} />
        <DayForecastTable dailyForecasts={dailyForecasts} bestSellDate={actByDate} lang={lang} theme={theme} />
      </div>

      {/* Save to Farmer History Action Card */}
      <div style={{
        background: 'var(--bg-subtle)',
        border: '1.5px solid var(--border-highlight)',
        borderRadius: '16px',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Pin size={17} color="var(--text-emerald)" />
            <span style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-title)' }}>
              {isMr ? 'हा सल्ला ट्रॅक करण्यासाठी जतन करा' : 'Track this Advisory in History'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
            {isMr
              ? 'दररोजच्या भावातील बदल व प्रत्यक्ष विक्री नोंदवून नफा ट्रॅक करा.'
              : 'Save batch to monitor daily holding advice and verify financial uplift.'}
          </p>
          {saveSuccess && (
            <div style={{ marginTop: '8px', color: 'var(--text-emerald)', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} />
              <span>{isMr ? 'यशस्वीरीत्या जतन केले! "इतिहास" टॅब तपासा.' : 'Saved! Check "History" tab.'}</span>
            </div>
          )}
          {saveError && (
            <div style={{ marginTop: '8px', color: 'var(--text-red)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        <div style={{ width: '100%', maxWidth: '220px' }}>
          <button
            type="button"
            id="save-to-batches-btn"
            onClick={handleSaveBatch}
            disabled={saveLoading || saveSuccess}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '11px 18px',
              fontSize: '0.85rem',
            }}
          >
            {saveLoading ? (
              <span className="loading-spinner" />
            ) : saveSuccess ? (
              <Check size={16} />
            ) : isAuthenticated ? (
              <Save size={16} />
            ) : (
              <Lock size={16} />
            )}
            <span>
              {saveLoading
                ? (isMr ? 'जतन होत आहे...' : 'Saving...')
                : saveSuccess
                  ? (isMr ? 'जतन केले!' : 'Saved!')
                  : isAuthenticated
                    ? (isMr ? 'इतिहासामध्ये सेव्ह करा' : 'Save Batch')
                    : (isMr ? 'लॉगिन करून सेव्ह करा' : 'Sign in to Save')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
