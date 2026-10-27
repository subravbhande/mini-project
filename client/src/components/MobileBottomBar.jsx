import React from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart3, ClipboardList, Sun, Moon, Globe, User, Bot } from 'lucide-react';

export default function MobileBottomBar({
  currentView = 'advisory',
  setCurrentView,
  lang = 'en',
  setLang,
  theme = 'dark',
  toggleTheme,
  onOpenAuthModal,
  onOpenAiAssistant,
}) {
  const { user, isAuthenticated } = useAuth();
  const isMr = lang === 'mr';
  const isDark = theme === 'dark';

  const handleHistoryClick = () => {
    if (isAuthenticated) {
      setCurrentView('history');
    } else {
      onOpenAuthModal('login');
    }
  };

  const handleLanguageToggle = () => {
    setLang(lang === 'en' ? 'mr' : 'en');
  };

  return (
    <nav className="mobile-bottom-dock" aria-label="Mobile Navigation">
      {/* 1. Advisory */}
      <button
        type="button"
        onClick={() => setCurrentView('advisory')}
        className={`mobile-dock-btn ${currentView === 'advisory' ? 'active' : ''}`}
      >
        <BarChart3 size={20} />
        <span>{isMr ? 'बाजार सल्ला' : 'Advisory'}</span>
      </button>

      {/* 2. History */}
      <button
        type="button"
        onClick={handleHistoryClick}
        className={`mobile-dock-btn ${currentView === 'history' ? 'active' : ''}`}
      >
        <ClipboardList size={20} />
        <span>{isMr ? 'इतिहास' : 'History'}</span>
      </button>

      {/* 3. AI Assistant */}
      <button
        type="button"
        onClick={onOpenAiAssistant}
        className="mobile-dock-btn"
        style={{ color: 'var(--text-emerald)' }}
        title="AI Assistant"
      >
        <Bot size={20} />
        <span style={{ fontWeight: 800 }}>{isMr ? 'AI मित्र' : 'AI Assistant'}</span>
      </button>


      {/* 3. Language Switch */}
      <button
        type="button"
        onClick={handleLanguageToggle}
        className="mobile-dock-btn"
        title="Switch Language"
      >
        <Globe size={19} />
        <span>{lang === 'en' ? 'मराठी' : 'English'}</span>
      </button>

      {/* 4. Theme Switch */}
      <button
        type="button"
        onClick={toggleTheme}
        className="mobile-dock-btn"
        title="Toggle Theme"
      >
        {isDark ? <Sun size={19} /> : <Moon size={19} />}
        <span>{isDark ? (isMr ? 'लाईट' : 'Light') : (isMr ? 'डार्क' : 'Dark')}</span>
      </button>

      {/* 5. User / Auth */}
      {isAuthenticated ? (
        <button
          type="button"
          onClick={() => setCurrentView('history')}
          className={`mobile-dock-btn ${currentView === 'history' ? 'active' : ''}`}
        >
          <User size={19} />
          <span style={{ maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name?.split(' ')[0] || (isMr ? 'शेतकरी' : 'Profile')}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onOpenAuthModal('login')}
          className="mobile-dock-btn"
        >
          <User size={19} />
          <span>{isMr ? 'लॉगिन' : 'Sign In'}</span>
        </button>
      )}
    </nav>
  );
}
