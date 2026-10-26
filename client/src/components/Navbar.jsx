import React from 'react';

export default function Navbar({ lang, setLang, systemStatus, theme, toggleTheme }) {
  const isOnline = systemStatus?.status === 'ok';
  const isMlOnline = systemStatus?.ml_service?.status === 'online';
  const isDbConnected = systemStatus?.database?.status === 'connected';

  let statusColor = '#22c55e';
  let statusTextEn = 'XGBoost 49-Feature AI Live';
  let statusTextMr = 'XGBoost मॉडेल सक्रिय';

  if (!isOnline && systemStatus !== undefined && systemStatus !== null) {
    statusColor = '#ef4444';
    statusTextEn = 'Backend Reconnecting';
    statusTextMr = 'सर्व्हर पुन्हा जोडत आहे';
  } else if (systemStatus?.ml_service?.fallbackAvailable && !isMlOnline) {
    statusColor = '#38bdf8';
    statusTextEn = 'ML Python Bridge Active';
    statusTextMr = 'पायथन ML सक्रिय';
  } else if (isMlOnline) {
    statusColor = '#22c55e';
    statusTextEn = 'ML Microservice + Backend Live';
    statusTextMr = 'ML मायक्रोसर्व्हिस सक्रिय';
  }

  const isDark = theme === 'dark';
  const isMr = lang === 'mr';

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-nav)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 24px',
      transition: 'background 0.25s ease, border-color 0.25s ease',
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
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-title)' }}>
                AgriSense
              </span>
              {/* <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--text-emerald)',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                ML ADVISORY
              </span> */}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isMr
                ? 'कृत्रिम बुद्धिमत्ता बाजारभाव अंदाज व विक्री सल्लागार'
                : 'AI-Powered Market Price Forecast & Decision Advisory'}
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>


          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={isDark
              ? (isMr ? 'लाईट मोड सुरू करा (Switch to Light Mode)' : 'Switch to Light Mode')
              : (isMr ? 'डार्क मोड सुरू करा (Switch to Dark Mode)' : 'Switch to Dark Mode')}
            aria-label="Toggle theme"
          >
            <span className="theme-icon-rotate" style={{ fontSize: '1rem' }}>
              {isDark ? '☀️' : '🌙'}
            </span>
            <span>
              {isDark
                ? (isMr ? 'प्रकाश' : 'Light')
                : (isMr ? 'गडद' : 'Dark')}
            </span>
          </button>

          {/* Language Switch */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '3px',
            transition: 'background 0.2s, border-color 0.2s',
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
