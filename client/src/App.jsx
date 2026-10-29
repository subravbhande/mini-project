import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MobileBottomBar from './components/MobileBottomBar';
import PriceQueryForm from './components/PriceQueryForm';
import PriceAdvisoryResult from './components/PriceAdvisoryResult';
import FarmerHistoryView from './components/FarmerHistoryView';
import AuthModal from './components/AuthModal';
import AgriLoader from './components/AgriLoader';
import AiAssistantDrawer from './components/AiAssistantDrawer';
import { useAuth } from './context/AuthContext';
import { fetchMarkets, fetchPriceForecast, evaluateTimingDecision, fetchHealth } from './services/priceApi';
import { Lock, AlertTriangle, Sprout, Bot } from 'lucide-react';
import './App.css';


function App() {
  const { user, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState('advisory'); // 'advisory' | 'history'
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [assistantOpen, setAssistantOpen] = useState(false);

  const [lang, setLang] = useState('mr'); // default to Marathi for farmer accessibility
  const isMr = lang === 'mr';

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('agrisense_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  });

  const [marketsData, setMarketsData] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [formData, setFormData] = useState({
    commodity: 'Tomato',
    market: 'Kolhapur',
    district: 'Kolhapur',
    quantity_quintals: 50,
    storage_type: 'ambient',
    liquidity_need: 'normal',
    horizon_days: 5,
    harvest_date: new Date().toISOString().slice(0, 10),
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const openAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  // Sync theme with HTML document attribute & localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('agrisense_theme', theme);
    } catch (e) {
      console.warn('Could not persist theme to localStorage', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Fetch system health and available markets on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const health = await fetchHealth();
        setSystemStatus(health);
      } catch (err) {
        console.warn('Backend health check warning:', err.message);
        setSystemStatus({ status: 'error' });
      }

      try {
        const data = await fetchMarkets();
        setMarketsData(data);
      } catch (err) {
        console.warn('Could not load markets from backend, using defaults:', err.message);
      }
    }
    loadInitialData();
  }, []);

  // Submit farmer query to combined decision engine
  const handleForecastSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await evaluateTimingDecision({
        commodity: formData.commodity.toLowerCase(),
        market: formData.market,
        district: formData.district,
        quantityQuintals: Number(formData.quantity_quintals) || 50,
        storageType: formData.storage_type || 'ambient',
        liquidityNeed: formData.liquidity_need || 'normal',
        harvestDate: formData.harvest_date || new Date().toISOString().slice(0, 10),
        forecastHorizonDays: Math.min(Number(formData.horizon_days) || 5, 5),
      });
      setResult(data);
    } catch (err) {
      console.warn('Decision evaluate endpoint warning, trying direct price forecast fallback:', err.message);
      try {
        const fallbackData = await fetchPriceForecast({
          commodity: formData.commodity,
          market: formData.market,
          district: formData.district,
          quantity_quintals: Number(formData.quantity_quintals) || 50,
          harvest_date: formData.harvest_date || new Date().toISOString().slice(0, 10),
          horizon_days: Math.min(Number(formData.horizon_days) || 5, 5),
        });
        setResult(fallbackData);
      } catch (fallbackErr) {
        console.error('Forecast request failed:', fallbackErr);
        let msg =
          fallbackErr.response?.data?.message ||
          fallbackErr.response?.data?.error ||
          fallbackErr.message ||
          'Failed to connect to backend service.';

        const is502 = fallbackErr.response?.status === 502 || String(msg).includes('502');
        if (is502) {
          msg = isMr
            ? 'क्लाउड सर्व्हर सुरू होत आहे (Render Cold Start). कृपया १०-१५ सेकंद थांबा आणि पुन्हा प्रयत्न करा.'
            : 'Cloud server is spinning up (Render Cold Start). Please wait 10-15 seconds and click Retry.';
        }
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Run initial forecast automatically once on mount
  useEffect(() => {
    let active = true;
    let retried = false;

    async function runInitial() {
      setLoading(true);
      setError(null);
      try {
        const data = await evaluateTimingDecision({
          commodity: 'tomato',
          market: 'Kolhapur',
          district: 'Kolhapur',
          quantityQuintals: 50,
          storageType: 'ambient',
          liquidityNeed: 'normal',
        });
        if (active) {
          setResult(data);
          setError(null);
        }
      } catch (err) {
        console.warn('Initial decision evaluate warning, trying fallback:', err.message);
        try {
          const fallbackData = await fetchPriceForecast({
            commodity: 'Tomato',
            market: 'Kolhapur',
            district: 'Kolhapur',
            quantity_quintals: 50,
            horizon_days: 5,
          });
          if (active) {
            setResult(fallbackData);
            setError(null);
          }
        } catch (fErr) {
          if (active) {
            const is502 = fErr.response?.status === 502 || String(fErr.message).includes('502');
            if (is502 && !retried) {
              retried = true;
              setError(
                isMr
                  ? 'क्लाउड सर्व्हर सुरू होत आहे (Render Cold Start). काही सेकंदात आपोआप कनेक्ट होईल...'
                  : 'Cloud server is waking up (Render Cold Start). Reconnecting automatically in a few seconds...'
              );
              setTimeout(() => {
                if (active) runInitial();
              }, 4000);
            } else {
              const friendlyMsg = is502
                ? (isMr
                  ? 'क्लाउड सर्व्हर सुरू होत आहे. कृपया "पुन्हा प्रयत्न करा" बटणावर क्लिक करा.'
                  : 'Cloud server is spinning up. Please click "Retry" below.')
                : (fErr.response?.data?.message || fErr.message || 'Failed to connect to backend service.');
              setError(friendlyMsg);
            }
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    runInitial();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      {/* Top Navbar */}
      <Navbar
        lang={lang}
        setLang={setLang}
        systemStatus={systemStatus}
        theme={theme}
        toggleTheme={toggleTheme}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenAuthModal={openAuthModal}
        onOpenAiAssistant={() => setAssistantOpen(true)}
      />


      <main className="app-main-container">
        {/* VIEW 1: FARMER HISTORY & PORTFOLIO */}
        {currentView === 'history' ? (
          isAuthenticated ? (
            <FarmerHistoryView
              user={user}
              lang={lang}
              theme={theme}
              onNavigateAdvisory={() => setCurrentView('advisory')}
            />
          ) : (
            <div className="glass-card" style={{ maxWidth: '600px', margin: '30px auto', padding: 'clamp(24px, 5vw, 40px)', textAlign: 'center' }}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '18px',
                  background: 'var(--bg-pill)',
                  border: '1.5px solid var(--border-highlight)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Lock size={32} color="var(--accent-green)" />
                </div>
              </div>
              <h2 style={{ fontSize: 'clamp(1.2rem, 3.5vw, 1.5rem)', fontWeight: 800, color: 'var(--text-title)', marginBottom: '10px' }}>
                {isMr ? 'आपला शेतकरी इतिहास पाहण्यासाठी लॉगिन करा' : 'Sign In to View Your History'}
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '22px' }}>
                {isMr
                  ? 'मागील सल्ले, सध्या साठवून ठेवलेला शेतमाल आणि प्रत्यक्ष विक्रीतून मिळालेला एकूण निव्वळ नफा ट्रॅक करण्यासाठी आपल्या मोबाईल नंबरने लॉगिन करा.'
                  : 'Log in with your mobile number to view active harvest holding batches, daily advice, and lifetime economic uplift from optimized sale timing.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="btn-primary"
                  style={{ padding: '12px 22px', fontSize: '0.88rem' }}
                >
                  {isMr ? 'लॉगिन / नवीन खाते' : 'Sign In / Register'}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('advisory')}
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-title)',
                    borderRadius: '12px',
                    padding: '12px 20px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  {isMr ? '← सल्ल्यावर परत जा' : '← Back to Advisory'}
                </button>
              </div>
            </div>
          )
        ) : (
          /* VIEW 2: PUBLIC PRICE ADVISORY */
          <>
            {/* Hero Intro */}
            <div style={{ textAlign: 'center', marginBottom: '28px', maxWidth: '820px', margin: '0 auto 28px' }}>


              <h1 className="hero-title">
                {isMr ? (
                  <>शेतमाल आज विकावा की <span style={{ color: 'var(--accent-green)' }}>राखून ठेवावा?</span></>
                ) : (
                  <>Sell Today or <span style={{ color: 'var(--accent-green)' }}>Hold for Better Rates?</span></>
                )}
              </h1>

              <p className="hero-subtitle">
                {isMr
                  ? 'थेट १ ते ५ दिवसांचे बाजारभाव अंदाज, नैसर्गिक घट, साठवणूक खर्च आणि ब्रेक-इव्हन विश्लेषणाचा अभ्यास करून शेतकऱ्यांना अचूक विक्री सल्ला.'
                  : 'Direct multi-step price forecasts, dynamic crop spoilage decay, and holding break-even analysis to recommend optimal APMC sale timing.'}
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div style={{
                maxWidth: '900px',
                margin: '0 auto 20px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                color: 'var(--text-red)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '0.86rem' }}>
                    <strong>{isMr ? 'त्रुटी:' : 'Error:'}</strong> {error}
                  </div>
                </div>
                <button
                  onClick={() => handleForecastSubmit()}
                  style={{
                    background: 'rgba(239, 68, 68, 0.25)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    color: 'var(--text-red)',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  {isMr ? 'पुन्हा प्रयत्न करा' : 'Retry'}
                </button>
              </div>
            )}

            {/* Main Content Grid: Form (Left) & Results (Right) */}
            <div className={`content-grid ${result ? 'has-result' : 'no-result'}`}>
              {/* Query Form Column */}
              <div>
                <PriceQueryForm
                  formData={formData}
                  setFormData={setFormData}
                  marketsData={marketsData}
                  onSubmit={handleForecastSubmit}
                  loading={loading}
                  lang={lang}
                  theme={theme}
                />
              </div>

              {/* Results Column */}
              <div>
                {loading && !result ? (
                  <AgriLoader lang={lang} />
                ) : result ? (
                  <PriceAdvisoryResult
                    result={result}
                    formData={formData}
                    lang={lang}
                    theme={theme}
                    onOpenAuthModal={openAuthModal}
                    onBatchSaved={() => { }}
                  />
                ) : null}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Auth Modal (Login / Register / Forgot PIN) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        lang={lang}
        theme={theme}
        onSuccess={() => {
          setAuthModalOpen(false);
          if (authModalMode === 'login' || authModalMode === 'register') {
            setCurrentView('history');
          }
        }}
      />

      {/* Mobile Bottom Navigation Dock */}
      <MobileBottomBar
        currentView={currentView}
        setCurrentView={setCurrentView}
        lang={lang}
        setLang={setLang}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenAuthModal={openAuthModal}
        onOpenAiAssistant={() => setAssistantOpen(true)}
      />

      {/* AI Assistant Floating Chatbot Widget */}
      <AiAssistantDrawer
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        lang={lang}
        setLang={setLang}
        theme={theme}
        formData={{ ...formData, activeResult: result }}
      />


      {/* ── Floating Chatbot FAB (bottom-right, all devices) ── */}
      {!assistantOpen && (
        <button
          type="button"
          id="floating-ai-assistant-btn"
          onClick={() => setAssistantOpen(true)}
          title={isMr ? 'AI कृषी मित्र खोला' : 'Open AI Agri Assistant'}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9998,
            background: 'var(--emerald-gradient)',
            color: '#ffffff',
            border: '2px solid rgba(255,255,255,0.2)',
            borderRadius: '50px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 28px rgba(65,97,27,0.5), 0 0 0 1px rgba(255,255,255,0.15), 0 0 20px rgba(131,170,70,0.25)',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '0.84rem',
            fontFamily: 'inherit',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: 'fabPop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.04)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(65,97,27,0.6), 0 0 0 1px rgba(255,255,255,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(65,97,27,0.5), 0 0 0 1px rgba(255,255,255,0.15), 0 0 20px rgba(131,170,70,0.25)'; }}
        >
          <Bot size={19} />
          <span className="fab-label">{isMr ? 'AI कृषी मित्र' : 'AI Assistant'}</span>
          <span style={{
            width: '8px', height: '8px',
            borderRadius: '50%',
            background: '#4ade80',
            boxShadow: '0 0 8px #4ade80',
          }} />
        </button>
      )}


      {/* Footer (Desktop & Tablet only) */}
      <footer className="desktop-footer" style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-footer)',
        backdropFilter: 'blur(10px)',
        padding: '18px 20px',
        textAlign: 'center',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        marginTop: 'auto',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ color: 'var(--text-body)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sprout size={15} color="var(--accent-green)" />
            <strong>Distress-Sale Timing Advisor</strong> — Decision Support for Farmers
          </span>
          <span>Kolhapur & Sangli APMC Markets • Climatology & Multi-Step Machine Learning</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
