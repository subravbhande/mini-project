import React from 'react';

export default function Navbar({ lang, setLang }) {
  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 15, 24, 0.8)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 24px',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'var(--emerald-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
          }}>
            🌱
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                AgriSense
              </span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--text-emerald)',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                ML ADVISORY
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {lang === 'mr' 
                ? 'कृत्रिम बुद्धिमत्ता बाजारभाव अंदाज व विक्री सल्लागार' 
                : 'AI-Powered Mandi Price Forecast & Decision Advisory'}
            </p>
          </div>
        </div>

        {/* Right side widgets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Status Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-subtle)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 10px #22c55e'
            }} className="status-pulse" />
            <span>
              {lang === 'mr' ? 'XGBoost मॉडेल सक्रिय' : 'XGBoost 49-Feature AI Live'}
            </span>
          </div>

          {/* Language Switch */}
          <div style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '3px'
          }}>
            <button
              onClick={() => setLang('en')}
              style={{
                background: lang === 'en' ? 'var(--emerald-gradient)' : 'transparent',
                color: lang === 'en' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '7px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              EN
            </button>
            <button
              onClick={() => setLang('mr')}
              style={{
                background: lang === 'mr' ? 'var(--emerald-gradient)' : 'transparent',
                color: lang === 'mr' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '7px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              मराठी
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
