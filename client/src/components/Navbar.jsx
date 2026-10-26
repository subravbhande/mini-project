import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sprout, BarChart3, ClipboardList, Lock, User, LogOut, Sun, Moon, ChevronDown } from 'lucide-react';

export default function Navbar({
  lang,
  setLang,
  systemStatus,
  theme,
  toggleTheme,
  currentView = 'advisory', // 'advisory' | 'history'
  setCurrentView,
  onOpenAuthModal,
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isDark = theme === 'dark';
  const isMr = lang === 'mr';

  const handleHistoryClick = () => {
    if (isAuthenticated) {
      setCurrentView('history');
    } else {
      onOpenAuthModal('login');
    }
  };

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-nav)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '12px 24px',
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
        <div
          onClick={() => setCurrentView('advisory')}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
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
            <Sprout size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-title)' }}>
                AgriSense
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isMr
                ? 'कृत्रिम बुद्धिमत्ता बाजारभाव अंदाज व विक्री सल्लागार'
                : 'AI-Powered Market Price Forecast & Decision Advisory'}
            </p>
          </div>
        </div>

        {/* Center / Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            id="nav-tab-advisory"
            onClick={() => setCurrentView('advisory')}
            style={{
              background: currentView === 'advisory' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: currentView === 'advisory' ? 'var(--text-emerald)' : 'var(--text-body)',
              border: currentView === 'advisory' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <BarChart3 size={16} />
            <span>{isMr ? 'बाजार भाव सल्ला' : 'Price Advisory'}</span>
          </button>

          <button
            type="button"
            id="nav-tab-history"
            onClick={handleHistoryClick}
            style={{
              background: currentView === 'history' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: currentView === 'history' ? 'var(--text-emerald)' : 'var(--text-body)',
              border: currentView === 'history' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ClipboardList size={16} />
            <span>{isMr ? 'माझा इतिहास' : 'My History'}</span>
            {!isAuthenticated && (
              <span style={{
                fontSize: '0.65rem',
                background: 'var(--bg-pill)',
                padding: '2px 6px',
                borderRadius: '4px',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                <Lock size={11} /> Login
              </span>
            )}
          </button>
        </div>

        {/* Right side controls (User, Theme, Language) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Auth Button or User Dropdown */}
          {isAuthenticated ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-title)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                <User size={16} />
                <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name || (isMr ? 'बळीराजा' : 'Farmer')}
                </span>
                <ChevronDown size={14} />
              </button>

              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '110%',
                    background: 'var(--bg-nav)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    padding: '8px',
                    minWidth: '180px',
                    zIndex: 100,
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-title)' }}>{user?.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{user?.phone}</div>
                  </div>

                  <button
                    onClick={() => {
                      setCurrentView('history');
                      setDropdownOpen(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      color: 'var(--text-title)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <ClipboardList size={16} />
                    <span>{isMr ? 'माझा शेतमाल इतिहास' : 'My Harvest History'}</span>
                  </button>

                  <button
                    onClick={() => {
                      logout();
                      setDropdownOpen(false);
                      setCurrentView('advisory');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      color: 'var(--text-red)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderTop: '1px solid var(--border-subtle)',
                      marginTop: '4px',
                    }}
                  >
                    <LogOut size={16} />
                    <span>{isMr ? 'बाहेर पडा (Logout)' : 'Logout'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuthModal('login')}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--text-emerald)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '10px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <User size={16} />
              <span>{isMr ? 'लॉगिन / नोंदणी' : 'Sign In'}</span>
            </button>
          )}

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
            <span className="theme-icon-rotate" style={{ display: 'inline-flex', alignItems: 'center' }}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
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
