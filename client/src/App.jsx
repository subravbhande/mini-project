import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PriceQueryForm from './components/PriceQueryForm';
import PriceAdvisoryResult from './components/PriceAdvisoryResult';
import FarmerHistoryView from './components/FarmerHistoryView';
import AuthModal from './components/AuthModal';
import { useAuth } from './context/AuthContext';
import { fetchMarkets, fetchPriceForecast, evaluateTimingDecision, fetchHealth } from './services/priceApi';
import { Lock, Wheat, AlertTriangle, Sprout } from 'lucide-react';

function App() {
  const { user, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState('advisory'); // 'advisory' | 'history'
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'register' | 'forgot'

  const [lang, setLang] = useState('en');
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
      // Primary: call combined economic decision engine (Price + Shelf-life + Storage + Liquidity)
      const data = await evaluateTimingDecision({
        commodity: formData.commodity.toLowerCase(),
        market: formData.market,
        district: formData.district,
        quantityQuintals: Number(formData.quantity_quintals) || 50,
        storageType: formData.storage_type || 'ambient',
        liquidityNeed: formData.liquidity_need || 'normal',
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
          horizon_days: Math.min(Number(formData.horizon_days) || 5, 5),
        });
        setResult(fallbackData);
      } catch (fallbackErr) {
        console.error('Forecast request failed:', fallbackErr);
        const msg =
          fallbackErr.response?.data?.message ||
          fallbackErr.response?.data?.error ||
          fallbackErr.message ||
          'Failed to connect to backend service.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Run initial forecast automatically once on mount so user sees live advisory
  useEffect(() => {
    let active = true;
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
        if (active) setResult(data);
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
          if (active) setResult(fallbackData);
        } catch (fErr) {
          if (active) setError(fErr.message || 'Failed to connect to backend service.');
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

  const isMr = lang === 'mr';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar
        lang={lang}
        setLang={setLang}
        systemStatus={systemStatus}
        theme={theme}
        toggleTheme={toggleTheme}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenAuthModal={openAuthModal}
      />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px', flex: 1, width: '100%' }}>
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
            <div className="glass-card" style={{ maxWidth: '640px', margin: '40px auto', padding: '36px', textAlign: 'center' }}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                <Lock size={48} color="var(--text-emerald)" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '12px' }}>
                {isMr ? 'आपला शेतकरी इतिहास पाहण्यासाठी लॉगिन करा' : 'Sign In to View Your History'}
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                {isMr
                  ? 'मागील सल्ले, सध्या साठवून ठेवलेला शेतमाल आणि प्रत्यक्ष विक्रीतून मिळालेला एकूण निव्वळ नफा ट्रॅक करण्यासाठी आपल्या मोबाईल नंबरने लॉगिन करा.'
                  : 'Log in with your mobile number to view active harvest holding batches, daily advice, and lifetime economic uplift from optimized sale timing.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  style={{
                    background: 'var(--emerald-gradient)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 24px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  {isMr ? 'लॉगिन करा / नवीन खाते' : 'Sign In / Register'}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('advisory')}
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-title)',
                    borderRadius: '10px',
                    padding: '12px 24px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  {isMr ? '← बाजारभाव सल्ल्यावर परत जा' : '← Back to Public Advisory'}
                </button>
              </div>
            </div>
          )
        ) : (
          /* VIEW 2: PUBLIC PRICE ADVISORY (NO LOGIN REQUIRED) */
          <>
            {/* Hero Intro */}
            <div style={{ textAlign: 'center', marginBottom: '32px', maxWidth: '840px', margin: '0 auto 32px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '20px',
                padding: '6px 18px',
                fontSize: '0.82rem',
                color: 'var(--text-emerald)',
                fontWeight: 700,
                marginBottom: '14px'
              }}>
                <Wheat size={16} />
                <span>
                  {isMr ? 'शेतकऱ्यांसाठी AI निर्णय सहाय्यक — तोटा टाळा, नफा वाढवा' : 'Distress-Sale Timing Advisor • Price & Spoilage Optimization'}
                </span>
              </div>

              <h1 style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text-title)',
                marginBottom: '12px',
                lineHeight: 1.2
              }}>
                {isMr ? (
                  <>शेतमाल आज विकावा की <span style={{ color: 'var(--text-emerald)' }}>राखून ठेवावा?</span></>
                ) : (
                  <>Sell Today or <span style={{ color: 'var(--text-emerald)' }}>Hold for Better Rates?</span></>
                )}
              </h1>

              <p style={{ fontSize: '1.02rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {isMr
                  ? 'थेट १ ते ५ दिवसांचे बाजारभाव अंदाज, नैसर्गिक घट, साठवणूक खर्च आणि ब्रेक-इव्हन विश्लेषणाचा अभ्यास करून शेतकऱ्यांना अचूक विक्री सल्ला.'
                  : 'Our decision engine combines leak-free direct multi-step price forecasts, dynamic crop spoilage modeling, and holding break-even analysis to recommend optimal sale timing.'}
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div style={{
                maxWidth: '1000px',
                margin: '0 auto 24px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--text-red)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={20} />
                  <div>
                    <strong>{isMr ? 'त्रुटी (Error):' : 'Error:'}</strong> {error}
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
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  {isMr ? 'पुन्हा प्रयत्न करा' : 'Retry'}
                </button>
              </div>
            )}

            {/* Main Content Grid: Form (Left) & Results (Right) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: result ? '380px 1fr' : 'minmax(320px, 600px)',
              justifyContent: result ? 'stretch' : 'center',
              gap: '24px',
              alignItems: 'start'
            }}>
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
              {result && (
                <div>
                  <PriceAdvisoryResult
                    result={result}
                    formData={formData}
                    lang={lang}
                    theme={theme}
                    onOpenAuthModal={openAuthModal}
                    onBatchSaved={() => {}}
                  />
                </div>
              )}
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
          // If user logged in while clicking history, take them to history view
          if (authModalMode === 'login' || authModalMode === 'register') {
            setCurrentView('history');
          }
        }}
      />

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-footer)',
        backdropFilter: 'blur(10px)',
        padding: '20px 24px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        marginTop: '40px'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ color: 'var(--text-body)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sprout size={16} color="var(--text-emerald)" />
            <strong>Distress-Sale Timing Advisor</strong> — Decision Support System for Farmers
          </span>
          <span>Kolhapur & Sangli APMC Mandis • Climatology & Multi-Step Machine Learning</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
