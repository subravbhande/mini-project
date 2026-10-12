import React from 'react';

export default function PriceQueryForm({
  formData,
  setFormData,
  marketsData,
  onSubmit,
  loading,
  lang,
}) {
  const isMr = lang === 'mr';

  const availableMarkets =
    marketsData?.markets?.[formData.commodity] ||
    (formData.commodity === 'Tomato'
      ? [
          { market: 'Kolhapur', district: 'Kolhapur' },
          { market: 'Vita', district: 'Sangli' },
        ]
      : [
          { market: 'Sangli', district: 'Sangli' },
          { market: 'Islampur', district: 'Sangli' },
          { market: 'Sangli-Phale-Bhajipala', district: 'Sangli' },
          { market: 'Vadgaonpeth', district: 'Sangli' },
          { market: 'Palus', district: 'Sangli' },
        ]);

  const handleCommoditySelect = (crop) => {
    const newMarkets = marketsData?.markets?.[crop] || (crop === 'Tomato' 
      ? [{ market: 'Kolhapur', district: 'Kolhapur' }]
      : [{ market: 'Sangli', district: 'Sangli' }]);
    
    setFormData((prev) => ({
      ...prev,
      commodity: crop,
      market: newMarkets[0]?.market || '',
      district: newMarkets[0]?.district || '',
    }));
  };

  const handleMarketChange = (e) => {
    const selectedMkt = availableMarkets.find((m) => m.market === e.target.value);
    if (selectedMkt) {
      setFormData((prev) => ({
        ...prev,
        market: selectedMkt.market,
        district: selectedMkt.district,
      }));
    }
  };

  const addQty = (amount) => {
    setFormData((prev) => ({
      ...prev,
      quantity_quintals: Math.max(1, (Number(prev.quantity_quintals) || 0) + amount),
    }));
  };

  const loadPreset = (crop, mkt, dist, qty) => {
    setFormData({
      commodity: crop,
      market: mkt,
      district: dist,
      quantity_quintals: qty,
      horizon_days: 7,
    });
  };

  return (
    <div className="glass-card" style={{ padding: '24px', position: 'relative' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
          {isMr ? 'शेतकरी इनपुट फॉर्म (Farmer Input)' : 'Enter Your Harvest Details'}
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isMr
            ? 'आपले पीक, बाजार समिती आणि प्रमाण निवडा — AI मॉडेल पुढील ७ ते १४ दिवसांचे भाव सांगेल.'
            : 'Select your crop, target mandi, and harvest volume to generate AI price predictions.'}
        </p>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Step 1: Crop Selection */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            1. {isMr ? 'पीक निवडा (Select Crop)' : 'Select Crop'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Tomato Card */}
            <button
              type="button"
              onClick={() => handleCommoditySelect('Tomato')}
              style={{
                background: formData.commodity === 'Tomato' 
                  ? 'rgba(239, 68, 68, 0.15)' 
                  : 'rgba(15, 23, 42, 0.6)',
                border: formData.commodity === 'Tomato' 
                  ? '2px solid var(--accent-red)' 
                  : '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                textAlign: 'left',
                transition: 'all 0.2s',
                boxShadow: formData.commodity === 'Tomato' ? '0 0 20px rgba(239, 68, 68, 0.2)' : 'none'
              }}
            >
              <div style={{
                fontSize: '2rem',
                width: '46px',
                height: '46px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(239, 68, 68, 0.15)',
                borderRadius: '10px'
              }}>
                🍅
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>
                  {isMr ? 'टोमॅटो (Tomato)' : 'Tomato'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isMr ? 'कोल्हापूर, विटा' : 'Kolhapur, Vita APMC'}
                </div>
              </div>
            </button>

            {/* Onion Card */}
            <button
              type="button"
              onClick={() => handleCommoditySelect('Onion')}
              style={{
                background: formData.commodity === 'Onion' 
                  ? 'rgba(139, 92, 246, 0.15)' 
                  : 'rgba(15, 23, 42, 0.6)',
                border: formData.commodity === 'Onion' 
                  ? '2px solid var(--accent-purple)' 
                  : '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                textAlign: 'left',
                transition: 'all 0.2s',
                boxShadow: formData.commodity === 'Onion' ? '0 0 20px rgba(139, 92, 246, 0.2)' : 'none'
              }}
            >
              <div style={{
                fontSize: '2rem',
                width: '46px',
                height: '46px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(139, 92, 246, 0.15)',
                borderRadius: '10px'
              }}>
                🧅
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>
                  {isMr ? 'कांदा (Onion)' : 'Onion'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isMr ? 'सांगली, इस्लामपूर, पलूस' : 'Sangli, Islampur, Palus'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Target Market Mandi */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              2. {isMr ? 'बाजार समिती (Target Mandi)' : 'Target Mandi / APMC Market'}
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-emerald)', fontWeight: 600 }}>
              {isMr ? `जिल्हा: ${formData.district}` : `District: ${formData.district}`}
            </span>
          </div>

          <select
            value={formData.market}
            onChange={handleMarketChange}
            className="input-base"
            style={{ fontSize: '1rem', cursor: 'pointer' }}
          >
            {availableMarkets.map((m) => (
              <option key={m.market} value={m.market} style={{ background: '#0f172a', color: '#fff' }}>
                {m.market} ({m.district})
              </option>
            ))}
          </select>
        </div>

        {/* Step 3: Harvest Quantity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              3. {isMr ? 'उत्पादन प्रमाण (Harvest Quantity)' : 'Harvest Volume'}
            </label>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-gold)', fontWeight: 600 }}>
              {formData.quantity_quintals} Quintals = {(Number(formData.quantity_quintals) * 100).toLocaleString()} kg
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number"
              min="1"
              max="5000"
              value={formData.quantity_quintals}
              onChange={(e) => setFormData((prev) => ({ ...prev, quantity_quintals: e.target.value }))}
              placeholder="e.g. 50"
              className="input-base"
              style={{ flex: 1, fontSize: '1.05rem', fontWeight: 600 }}
              required
            />
            <span style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '10px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              fontWeight: 600
            }}>
              {isMr ? 'क्विंटल' : 'Quintals'}
            </span>
          </div>

          {/* Quick buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[10, 25, 50, 100].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => addQty(amt)}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseOver={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.25)')}
                onMouseOut={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
              >
                +{amt} qtl
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: Forecast Horizon */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            4. {isMr ? 'अंदाज कालावधी (Forecast Horizon)' : 'Forecast Horizon'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, horizon_days: 7 }))}
              style={{
                background: formData.horizon_days === 7 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                border: formData.horizon_days === 7 ? '1.5px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '10px',
                color: formData.horizon_days === 7 ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              📅 {isMr ? '७ दिवस (शिफारस केलेले)' : '7 Days (Recommended)'}
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, horizon_days: 14 }))}
              style={{
                background: formData.horizon_days === 14 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                border: formData.horizon_days === 14 ? '1.5px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '10px',
                color: formData.horizon_days === 14 ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              🗓️ {isMr ? '१४ दिवस (दीर्घ पल्ला)' : '14 Days (Extended)'}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{ width: '100%', marginTop: '6px' }}
        >
          {loading ? (
            <>
              <span className="loading-spinner" />
              <span>{isMr ? 'AI मॉडेल विश्लेषण करत आहे...' : 'Running XGBoost Model...'}</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>{isMr ? 'भाव अंदाज व सल्ला मिळवा' : 'Generate Price Forecast & Advisory'}</span>
            </>
          )}
        </button>

        {/* Quick Demo Pre-fill Links */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: 'var(--text-muted)'
        }}>
          <span>{isMr ? 'नमुना चाचणी (Quick Test):' : 'Try Quick Presets:'}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span
              onClick={() => loadPreset('Tomato', 'Kolhapur', 'Kolhapur', 50)}
              style={{ color: 'var(--text-emerald)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Tomato Kolhapur 50q
            </span>
            <span>•</span>
            <span
              onClick={() => loadPreset('Onion', 'Sangli', 'Sangli', 100)}
              style={{ color: 'var(--text-gold)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Onion Sangli 100q
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
