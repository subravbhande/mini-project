import React from 'react';
import { Calendar, CalendarDays, Zap, Sprout, ArrowRight } from 'lucide-react';
import AgriLoader from './AgriLoader';

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

  const cropKey = formData?.commodity
    ? (formData.commodity.charAt(0).toUpperCase() + formData.commodity.slice(1).toLowerCase())
    : 'Tomato';

  const availableMarkets =
    marketsData?.markets?.[cropKey] ||
    defaultMarkets[cropKey] ||
    defaultMarkets.Tomato;

  const handleCommoditySelect = (crop) => {
    const newMarkets = marketsData?.markets?.[crop] || defaultMarkets[crop] || defaultMarkets.Tomato;
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

  const cropStorageOptions = cropKey === 'Onion'
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

  const isTomatoSelected = cropKey === 'Tomato';
  const isOnionSelected = cropKey === 'Onion';

  return (
    <div className="glass-card" style={{ padding: '22px 20px', position: 'relative' }}>
      {/* Header */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Sprout size={18} color="var(--accent-green)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-title)' }}>
            {isMr ? 'शेतकरी इनपुट फॉर्म' : 'Enter Harvest Details'}
          </h2>
        </div>
        {/* <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {isMr
            ? 'आपले पीक, बाजार समिती, साठवणूक व प्रमाण निवडा — AI मॉडेल अचूक विक्री सल्ला देईल.'
            : 'Select crop, market, storage, and volume for AI distress-sale advisory.'}
        </p> */}
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Step 1: Crop Selection */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            1. {isMr ? 'पीक निवडा (Select Crop)' : 'Select Crop'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                borderRadius: '14px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isTomatoSelected ? '0 4px 14px rgba(239, 68, 68, 0.2)' : 'none',
              }}
            >
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                padding: '3px',
              }}>
                <img
                  src="/tomato.jpg"
                  alt="Tomato"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text-title)', fontSize: '0.92rem' }}>
                  {isMr ? 'टोमॅटो' : 'Tomato'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {isMr ? 'नाशवंत पीक' : 'Perishable'}
                </div>
              </div>
            </button>

            {/* Onion Card */}
            <button
              type="button"
              onClick={() => handleCommoditySelect('Onion')}
              style={{
                background: isOnionSelected
                  ? (isDark ? 'rgba(168, 85, 247, 0.16)' : 'rgba(147, 51, 234, 0.1)')
                  : 'var(--bg-subtle)',
                border: isOnionSelected
                  ? '2px solid #a855f7'
                  : '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isOnionSelected ? '0 4px 14px rgba(168, 85, 247, 0.2)' : 'none',
              }}
            >
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                padding: '3px',
              }}>
                <img
                  src="/onion.jpg"
                  alt="Onion"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text-title)', fontSize: '0.92rem' }}>
                  {isMr ? 'कांदा' : 'Onion'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {isMr ? 'साठवणूकक्षम' : 'Storable'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Market Selection */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            2. {isMr ? 'बाजार समिती (APMC Market)' : 'Target Market'}
          </label>
          <select
            value={formData.market}
            onChange={handleMarketChange}
            className="input-base"
            style={{ fontWeight: 600 }}
          >
            {availableMarkets.map((m) => (
              <option key={m.market} value={m.market}>
                {m.market} ({m.district})
              </option>
            ))}
          </select>
        </div>

        {/* Step 3: Quantity with Touch Stepper */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            3. {isMr ? 'शेतमाल प्रमाण (Quantity in Quintals)' : 'Harvest Volume (Quintals)'}
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
              style={{ flex: 1, fontSize: '1.05rem', fontWeight: 700 }}
              required
            />
            <span style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              background: 'var(--bg-pill)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              fontSize: '0.84rem',
              color: 'var(--text-body)',
              fontWeight: 700,
            }}>
              {isMr ? 'क्विंटल' : 'qtl'}
            </span>
          </div>

          {/* Quick Increment Steppers */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[10, 25, 50, 100].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => addQty(amt)}
                className="clickable-pill"
                style={{
                  background: 'var(--bg-pill)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-body)',
                  padding: '5px 11px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                +{amt} qtl
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: Storage & Liquidity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              marginBottom: '5px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              4. {isMr ? 'साठवणूक पद्धत' : 'Storage'}
            </label>
            <select
              value={formData.storage_type || (formData.commodity === 'Onion' ? 'ventilated_chawl' : 'ambient')}
              onChange={(e) => setFormData((prev) => ({ ...prev, storage_type: e.target.value }))}
              className="input-base"
              style={{ fontSize: '0.82rem', padding: '10px' }}
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
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              marginBottom: '5px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              5. {isMr ? 'पैशांची गरज' : 'Cash Need'}
            </label>
            <select
              value={formData.liquidity_need || 'normal'}
              onChange={(e) => setFormData((prev) => ({ ...prev, liquidity_need: e.target.value }))}
              className="input-base"
              style={{ fontSize: '0.82rem', padding: '10px' }}
            >
              <option value="normal">{isMr ? 'सामान्य' : 'Normal'}</option>
              <option value="immediate">{isMr ? 'तातडीची' : 'Urgent'}</option>
            </select>
          </div>
        </div>

        {/* Step 5: Horizon (Segmented iOS Toggle) */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            6. {isMr ? 'अंदाज कालावधी' : 'Forecast Horizon'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, horizon_days: 3 }))}
              style={{
                background: formData.horizon_days === 3
                  ? 'var(--bg-pill)'
                  : 'var(--bg-subtle)',
                border: formData.horizon_days === 3
                  ? '1.5px solid var(--accent-green)'
                  : '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '9px 8px',
                color: formData.horizon_days === 3 ? 'var(--text-emerald)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Calendar size={14} />
              <span>{isMr ? '३ दिवस (जलद)' : '3 Days'}</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, horizon_days: 5 }))}
              style={{
                background: formData.horizon_days === 5
                  ? 'var(--bg-pill)'
                  : 'var(--bg-subtle)',
                border: formData.horizon_days === 5
                  ? '1.5px solid var(--accent-green)'
                  : '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '9px 8px',
                color: formData.horizon_days === 5 ? 'var(--text-emerald)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <CalendarDays size={14} />
              <span>{isMr ? '५ दिवस (शिफारस)' : '5 Days (Rec)'}</span>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{ width: '100%', marginTop: '4px' }}
        >
          {loading ? (
            <AgriLoader compact lang={lang} customMessage={isMr ? 'निर्णय प्रक्रिया सुरू...' : 'Evaluating Decision...'} />
          ) : (
            <>
              <Zap size={18} />
              <span>{isMr ? 'विक्री वेळेचा AI सल्ला मिळवा' : 'Evaluate Sale Timing Advisory'}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>

        {/* Quick Demo Pre-fill Links */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.76rem',
          color: 'var(--text-muted)'
        }}>
          <span>{isMr ? 'नमुना:' : 'Presets:'}</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span
              onClick={() => loadPreset('Tomato', 'Kolhapur', 'Kolhapur', 50)}
              style={{ color: 'var(--text-emerald)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
            >
              Tomato 50q
            </span>
            <span>•</span>
            <span
              onClick={() => loadPreset('Onion', 'Sangli-Phale-Bhajipala', 'Sangli', 100)}
              style={{ color: 'var(--text-gold)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
            >
              Onion 100q
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
