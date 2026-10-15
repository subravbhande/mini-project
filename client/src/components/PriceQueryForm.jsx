import React from 'react';

export default function PriceQueryForm({
  formData,
  setFormData,
  marketsData,
  onSubmit,
  loading,
  lang,
  theme,
}) {
  const isMr = lang === 'mr';
  const isDark = theme === 'dark';

  const defaultMarkets = {
    Tomato: [
      { market: 'Kolhapur', district: 'Kolhapur' },
      { market: 'Vadgaonpeth', district: 'Kolhapur' },
      { market: 'Islampur', district: 'Sangli' },
    ],
    Onion: [
      { market: 'Kolhapur', district: 'Kolhapur' },
      { market: 'Vadgaonpeth', district: 'Kolhapur' },
      { market: 'Sangli-Phale-Bhajipala', district: 'Sangli' },
    ],
  };

  const availableMarkets =
    marketsData?.markets?.[formData.commodity] ||
    defaultMarkets[formData.commodity] ||
    defaultMarkets.Tomato;

  const handleCommoditySelect = (crop) => {
    const newMarkets = marketsData?.markets?.[crop] || defaultMarkets[crop] || defaultMarkets.Tomato;
    
    // Choose appropriate default storage for crop
    const defaultStorage = crop === 'Onion' ? 'ventilated_chawl' : 'ambient';

    setFormData((prev) => ({
      ...prev,
      commodity: crop,
      market: newMarkets[0]?.market || '',
      district: newMarkets[0]?.district || '',
      storage_type: defaultStorage,
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
    setFormData((prev) => ({
      ...prev,
      commodity: crop,
      market: mkt,
      district: dist,
      quantity_quintals: qty,
      horizon_days: 5,
      storage_type: crop === 'Onion' ? 'ventilated_chawl' : 'ambient',
      liquidity_need: 'normal',
    }));
  };

  const cropStorageOptions = formData.commodity === 'Onion'
    ? [
        { id: 'ambient', name: isMr ? 'खुली साठवण (Ambient)' : 'Ambient' },
        { id: 'ventilated_chawl', name: isMr ? 'कांदा चाळ (Chawl)' : 'Ventilated Chawl' },
        { id: 'cold_storage', name: isMr ? 'कोल्ड स्टोरेज (Cold)' : 'Cold Storage' },
      ]
    : [
        { id: 'ambient', name: isMr ? 'खुली साठवण (Ambient)' : 'Ambient' },
        { id: 'zecc', name: isMr ? 'शून्य ऊर्जा कक्ष (ZECC)' : 'ZECC Cooler' },
        { id: 'cold_storage', name: isMr ? 'कोल्ड स्टोरेज (Cold)' : 'Cold Storage' },
      ];

  const isTomatoSelected = formData.commodity === 'Tomato';
  const isOnionSelected = formData.commodity === 'Onion';

  return (
    <div className="glass-card" style={{ padding: '24px', position: 'relative' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '4px' }}>
          {isMr ? 'शेतकरी इनपुट फॉर्म (Farmer Input)' : 'Enter Your Harvest Details'}
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isMr
            ? 'आपले पीक, बाजार समिती, साठवणूक व प्रमाण निवडा — AI मॉडेल पुढील १ ते ५ दिवसांचा अचूक सल्ला देईल.'
            : 'Select your crop, mandi, storage type, and volume to get AI timing advisory.'}
        </p>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Step 1: Crop Selection */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.82rem',
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
                background: isTomatoSelected
                  ? (isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.1)')
                  : 'var(--bg-subtle)',
                border: isTomatoSelected
                  ? '2px solid #ef4444'
                  : '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                boxShadow: isTomatoSelected ? '0 4px 12px rgba(239, 68, 68, 0.18)' : 'none',
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>🍅</span>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-title)', fontSize: '0.95rem' }}>
                  {isMr ? 'टोमॅटो' : 'Tomato'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isMr ? 'नाशवंत पीक (३-५ दिवस)' : 'Perishable (3-5 days)'}
                </div>
              </div>
            </button>

            {/* Onion Card */}
            <button
              type="button"
              onClick={() => handleCommoditySelect('Onion')}
              style={{
                background: isOnionSelected
                  ? (isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.1)')
                  : 'var(--bg-subtle)',
                border: isOnionSelected
                  ? '2px solid #f59e0b'
                  : '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                boxShadow: isOnionSelected ? '0 4px 12px rgba(245, 158, 11, 0.18)' : 'none',
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>🧅</span>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-title)', fontSize: '0.95rem' }}>
                  {isMr ? 'कांदा' : 'Onion'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isMr ? 'साठवणूकक्षम पीक' : 'Storable Produce'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Mandi Selection */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            2. {isMr ? 'बाजार समिती (APMC Mandi)' : 'Target APMC Mandi'}
          </label>
          <select
            value={formData.market}
            onChange={handleMarketChange}
            className="input-base"
            style={{ width: '100%', fontSize: '0.95rem', fontWeight: 600 }}
          >
            {availableMarkets.map((m) => (
              <option key={m.market} value={m.market}>
                {m.market} ({m.district})
              </option>
            ))}
          </select>
        </div>

        {/* Step 3: Quantity */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            3. {isMr ? 'शेतमाल प्रमाण (Quantity in Quintals)' : 'Harvest Quantity (Quintals)'}
          </label>
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
              background: 'var(--bg-pill)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              fontSize: '0.85rem',
              color: 'var(--text-body)',
              fontWeight: 600
            }}>
              {isMr ? 'क्विंटल' : 'Quintals'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[10, 25, 50, 100].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => addQty(amt)}
                style={{
                  background: 'var(--bg-pill)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-body)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s, transform 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-pill-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-pill)')}
              >
                +{amt} qtl
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: Storage Type & Liquidity Need */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              4. {isMr ? 'साठवणूक पद्धत' : 'Storage'}
            </label>
            <select
              value={formData.storage_type || (formData.commodity === 'Onion' ? 'ventilated_chawl' : 'ambient')}
              onChange={(e) => setFormData((prev) => ({ ...prev, storage_type: e.target.value }))}
              className="input-base"
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              {cropStorageOptions.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              5. {isMr ? 'पैशांची गरज' : 'Cash Need'}
            </label>
            <select
              value={formData.liquidity_need || 'normal'}
              onChange={(e) => setFormData((prev) => ({ ...prev, liquidity_need: e.target.value }))}
              className="input-base"
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              <option value="normal">{isMr ? 'सामान्य (Normal)' : 'Normal'}</option>
              <option value="immediate">{isMr ? 'तातडीची गरज (Urgent)' : 'Urgent Cash'}</option>
            </select>
          </div>
        </div>

        {/* Step 5: Forecast Horizon */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            6. {isMr ? 'अंदाज कालावधी (Forecast Horizon)' : 'Forecast Horizon'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, horizon_days: 3 }))}
              style={{
                background: formData.horizon_days === 3
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'var(--bg-subtle)',
                border: formData.horizon_days === 3
                  ? '1.5px solid var(--accent-green)'
                  : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '10px',
                color: formData.horizon_days === 3 ? 'var(--text-title)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              📅 {isMr ? '३ दिवस (जलद अंदाज)' : '3 Days (Fast)'}
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, horizon_days: 5 }))}
              style={{
                background: formData.horizon_days === 5
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'var(--bg-subtle)',
                border: formData.horizon_days === 5
                  ? '1.5px solid var(--accent-green)'
                  : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '10px',
                color: formData.horizon_days === 5 ? 'var(--text-title)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🗓️ {isMr ? '५ दिवस (शिफारस केलेले)' : '5 Days (Recommended)'}
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
              <span>{isMr ? 'AI विश्लेषण व निर्णय प्रक्रिया सुरू आहे...' : 'Evaluating Decision...'}</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>{isMr ? 'विक्री वेळेचा AI सल्ला मिळवा' : 'Evaluate Sale Timing Advisory'}</span>
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
          <span>{isMr ? 'नमुना चाचणी (Quick Presets):' : 'Try Quick Presets:'}</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span
              onClick={() => loadPreset('Tomato', 'Kolhapur', 'Kolhapur', 50)}
              style={{ color: 'var(--text-emerald)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            >
              Tomato Kolhapur 50q
            </span>
            <span>•</span>
            <span
              onClick={() => loadPreset('Onion', 'Sangli-Phale-Bhajipala', 'Sangli', 100)}
              style={{ color: 'var(--text-gold)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
            >
              Onion Sangli 100q
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
