import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PriceQueryForm from './components/PriceQueryForm';
import PriceAdvisoryResult from './components/PriceAdvisoryResult';
import { fetchMarkets, fetchPriceForecast, fetchHealth } from './services/priceApi';

function App() {
  const [lang, setLang] = useState('en');
  const [marketsData, setMarketsData] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [formData, setFormData] = useState({
    commodity: 'Tomato',
    market: 'Kolhapur',
    district: 'Kolhapur',
    quantity_quintals: 50,
    horizon_days: 7,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  // Submit farmer query
  const handleForecastSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await fetchPriceForecast({
        commodity: formData.commodity,
        market: formData.market,
        district: formData.district,
        quantity_quintals: Number(formData.quantity_quintals) || 0,
        horizon_days: Number(formData.horizon_days) || 7,
      });
      setResult(data);
    } catch (err) {
      console.error('Forecast request failed:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to connect to ML backend.';
      setError(msg);
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
      <Navbar lang={lang} setLang={setLang} systemStatus={systemStatus} />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px', flex: 1, width: '100%' }}>
        {/* Hero Intro */}
        <div style={{ textAlign: 'center', marginBottom: '28px', maxWidth: '800px', margin: '0 auto 28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '20px',
            padding: '5px 16px',
            fontSize: '0.8rem',
            color: 'var(--text-emerald)',
            fontWeight: 700,
            marginBottom: '12px'
          }}>
            <span>🌾</span>
            <span>
              {isMr ? 'शेतकऱ्यांसाठी AI तंत्रज्ञान — अधिक नफा, अचूक विक्री वेळ' : 'Machine Learning Powered Mandi Price Intelligence'}
            </span>
          </div>

          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#fff',
            marginBottom: '12px',
            lineHeight: 1.2
          }}>
            {isMr ? (
              <>शेतमालाला कधी मिळणार <span style={{ color: '#34d399' }}>सर्वोत्तम भाव?</span></>
            ) : (
              <>When Should You Sell for <span style={{ color: '#34d399' }}>Peak Price?</span></>
            )}
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {isMr
              ? 'आमचे XGBoost AI मॉडेल ४९ घटकांचा (मागील भाव, हवामान, तापमान, पाऊस, आवक) अभ्यास करून अचूक भाव अंदाज व विक्री सल्ला देते.'
              : 'Our 49-feature XGBoost model factors in 14-day price lags, rolling volatility, temperature, and rainfall to tell farmers exactly when to sell and how much they will earn.'}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{
            maxWidth: '1000px',
            margin: '0 auto 20px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fca5a5'
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
                background: 'rgba(239, 68, 68, 0.3)',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                color: '#fff',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 600
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
            />
          </div>

          {/* Results Column */}
          {result && (
            <div>
              <PriceAdvisoryResult result={result} lang={lang} />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(10, 15, 24, 0.9)',
        padding: '20px 24px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        marginTop: '40px'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span>🌱 <strong>AgriSense</strong> — Decision Support System for Smart Agriculture</span>
          <span>Kolhapur & Sangli APMC Markets • Weather & Price Fusion Engine</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
