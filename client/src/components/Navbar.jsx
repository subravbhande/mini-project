import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sprout, BarChart3, ClipboardList, Lock, User, LogOut, Sun, Moon, ChevronDown, Bot } from 'lucide-react';

export default function Navbar({
  lang,
  setLang,
  systemStatus: _systemStatus,
  theme,
  toggleTheme,
  currentView = 'advisory',
  setCurrentView,
  onOpenAuthModal,
  onOpenAiAssistant,
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
      padding: '12px 20px',
      transition: 'background 0.25s ease, border-color 0.25s ease',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Brand */}
        <div
          onClick={() => setCurrentView('advisory')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'var(--emerald-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            boxShadow: '0 4px 14px rgba(65, 97, 27, 0.4)',
            flexShrink: 0,
          }}>
            <Sprout size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-title)' }}>
                AgriSense
              </span>

            </div>

          </div>
        </div>

        {/* Center / Navigation Tabs (Desktop only - hidden on mobile) */}
        <div className="desktop-nav-tabs" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            id="nav-tab-advisory"
            onClick={() => setCurrentView('advisory')}
            style={{
              background: currentView === 'advisory' ? 'var(--bg-pill)' : 'transparent',
              color: currentView === 'advisory' ? 'var(--text-emerald)' : 'var(--text-body)',
              border: currentView === 'advisory' ? '1px solid var(--border-highlight)' : '1px solid transparent',
              borderRadius: '10px',
              padding: '7px 14px',
              fontSize: '0.84rem',
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
              background: currentView === 'history' ? 'var(--bg-pill)' : 'transparent',
              color: currentView === 'history' ? 'var(--text-emerald)' : 'var(--text-body)',
              border: currentView === 'history' ? '1px solid var(--border-highlight)' : '1px solid transparent',
              borderRadius: '10px',
              padding: '7px 14px',
              fontSize: '0.84rem',
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

        {/* Right side controls (AI Assistant, User, Theme, Language) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* AI Assistant Button (Top Right) */}
          <button
            type="button"
            id="nav-ai-assistant-btn"
            onClick={onOpenAiAssistant}
            className="nav-ai-assistant-btn"
            title={isMr ? 'AI कृषी मित्र (शेतकरी सहाय्यक - ऑडिओ सह)' : 'AI Farmer Assistant (with Voice Agent)'}
            style={{
              background: 'linear-gradient(135deg, rgba(131, 170, 70, 0.2) 0%, rgba(65, 97, 27, 0.35) 100%)',
              color: 'var(--text-emerald)',
              border: '1.5px solid var(--border-highlight)',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(131, 170, 70, 0.25)',
              transition: 'all 0.2s ease',
            }}
          >
            <Bot size={16} />
            <span className="ai-btn-text">{isMr ? 'AI कृषी मित्र' : 'AI Assistant'}</span>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 6px #22c55e',
              }}
            />
          </button>

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
                  gap: '6px',
                  cursor: 'pointer',
                  color: 'var(--text-title)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                <User size={15} color="var(--text-emerald)" />
                <span style={{ maxWidth: '95px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name || (isMr ? 'बळीराजा' : 'Farmer')}
                </span>
                <ChevronDown size={14} />
              </button>

              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '115%',
                    background: 'var(--bg-nav)',
                    border: '1.5px solid var(--border-card)',
                    borderRadius: '14px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                    padding: '8px',
                    minWidth: '200px',
                    zIndex: 100,
                    backdropFilter: 'blur(16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-title)' }}>{user?.name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{user?.phone}</div>
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
                      borderRadius: '8px',
                      color: 'var(--text-title)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <ClipboardList size={16} color="var(--text-emerald)" />
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
                      borderRadius: '8px',
                      color: 'var(--text-red)',
                      fontSize: '0.82rem',
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
                background: 'var(--bg-pill)',
                color: 'var(--text-emerald)',
                border: '1px solid var(--border-highlight)',
                borderRadius: '10px',
                padding: '6px 13px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <User size={15} />
              <span>{isMr ? 'लॉगिन' : 'Sign In'}</span>
            </button>
          )}

          {/* Desktop Only: Theme & Language Controls */}
          <div className="desktop-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="theme-toggle-btn"
              title={isDark
                ? (isMr ? 'लाईट मोड (Light Mode)' : 'Switch to Light Mode')
                : (isMr ? 'डार्क मोड (Dark Mode)' : 'Switch to Dark Mode')}
              aria-label="Toggle theme"
            >
              <span className="theme-icon-rotate" style={{ display: 'inline-flex', alignItems: 'center' }}>
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </span>
              <span>{isDark ? (isMr ? 'लाईट' : 'Light') : (isMr ? 'डार्क' : 'Dark')}</span>
            </button>

            {/* Language Switch */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '2px',
            }}>
              <button
                onClick={() => setLang('en')}
                style={{
                  background: lang === 'en' ? 'var(--emerald-gradient)' : 'transparent',
                  color: lang === 'en' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '4px 9px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
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
                  borderRadius: '8px',
                  padding: '4px 9px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                मराठी
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 769px) {
          .desktop-subtitle { display: block !important; }
        }
        @media (max-width: 768px) {
          .desktop-nav-tabs, .desktop-controls { display: none !important; }
        }
      `}</style>
    </header>
  );
}
