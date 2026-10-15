import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PriceQueryForm from './components/PriceQueryForm';
import PriceAdvisoryResult from './components/PriceAdvisoryResult';
import { fetchMarkets, fetchPriceForecast, evaluateTimingDecision, fetchHealth } from './services/priceApi';

function App() {
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

  // Run initial forecast automatically so user sees a live dashboard immediately
  useEffect(() => {
    handleForecastSubmit();
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
      />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px', flex: 1, width: '100%' }}>
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
            <span>🌾</span>
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
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
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
              <PriceAdvisoryResult result={result} lang={lang} theme={theme} />
            </div>
          )}
        </div>
      </main>

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
          <span style={{ color: 'var(--text-body)' }}>🌱 <strong>Distress-Sale Timing Advisor</strong> — Decision Support System for Farmers</span>
          <span>Kolhapur & Sangli APMC Mandis • Climatology & Multi-Step Machine Learning</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
