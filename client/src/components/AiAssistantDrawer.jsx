import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, X, Send, Mic, MicOff, Volume2, VolumeX,
  Sparkles, RotateCcw, Copy, Check, Minimize2, Maximize2,
  AlertCircle, Sprout, TrendingUp, TrendingDown, Minus,
  ShoppingCart, Clock, BarChart3, Loader,
} from 'lucide-react';
import { askAgriAssistant, isPriceQuery, fetchPriceAdvisoryForChat } from '../services/assistantApi';

/* ── Live Market Price Card rendered inside chat ── */
function PriceMiniCard({ data, commodity, market, lang, theme, isFarmerIntent = false }) {
  const [showFarmerAdvice, setShowFarmerAdvice] = useState(isFarmerIntent);
  const isDark = theme === 'dark';
  const isMr = lang === 'mr';

  const result = data || {};
  const decision = result.decision || 'SELL';
  const todayPrice =
    result.last_observed_price ||
    result.price_forecast?.summary?.last_observed_price ||
    result.price_forecast?.daily_forecasts?.[0]?.predicted_modal_price ||
    0;

  // Approximate retail / consumer price per kg (1 Quintal = 100 kg)
  const perKg = todayPrice > 0 ? (todayPrice / 100).toFixed(1) : '—';

  // Min - Max spread from forecasts
  const daily0 = result.price_forecast?.daily_forecasts?.[0];
  const minPrice = daily0?.typical_daily_spread_min || daily0?.predicted_min_price || result.price_forecast?.summary?.min_forecast_price;
  const maxPrice = daily0?.typical_daily_spread_max || daily0?.predicted_max_price || result.price_forecast?.summary?.max_forecast_price;
  const minKg = minPrice > 0 ? (minPrice / 100).toFixed(1) : null;
  const maxKg = maxPrice > 0 ? (maxPrice / 100).toFixed(1) : null;

  // Trend
  const trend = result.price_forecast?.summary?.overall_trend || result.price_forecast?.summary?.price_trend || 'STABLE';
  const changePct = result.price_forecast?.summary?.projected_change_pct;

  const dailyForecasts = result.price_forecast?.daily_forecasts || [];
  const actByDate = result.act_by_date || '';
  const reasonText = isMr ? (result.reason_mr || result.reason || '') : (result.reason || '');

  const isHold = decision === 'HOLD';
  const isPartial = decision === 'PARTIAL_SELL';
  const decisionColor = isHold ? '#4ade80' : isPartial ? '#f59e0b' : '#ef4444';
  const decisionBg = isHold
    ? 'rgba(74,222,128,0.12)'
    : isPartial ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  const decisionBorder = isHold
    ? 'rgba(74,222,128,0.3)'
    : isPartial ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';

  const decisionLabel = isHold
    ? (isMr ? 'थांबा — भाव वाढणार' : 'HOLD — Prices Rising')
    : isPartial
      ? (isMr ? 'अर्धे विका' : 'PARTIAL SELL')
      : (isMr ? 'आता विका' : 'SELL NOW');

  const fmt = (n) => (n > 0 ? `₹${Number(n).toFixed(0)}` : '—');

  return (
    <div
      style={{
        background: isDark ? 'rgba(16,24,18,0.96)' : '#ffffff',
        border: `1.5px solid ${isDark ? 'rgba(131,170,70,0.3)' : 'rgba(65,97,27,0.2)'}`,
        borderRadius: '14px',
        overflow: 'hidden',
        fontSize: '0.78rem',
        maxWidth: '100%',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 18px rgba(0,0,0,0.06)',
      }}
    >
      {/* ── Card Header (Market Focused) ── */}
      <div
        style={{
          background: isDark ? 'rgba(131,170,70,0.14)' : 'rgba(65,97,27,0.06)',
          borderBottom: `1px solid ${isDark ? 'rgba(131,170,70,0.2)' : 'rgba(65,97,27,0.1)'}`,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-emerald)' }}>
          <BarChart3 size={15} />
          <span>{isMr ? 'आजचा थेट बाजारभाव' : 'Live APMC Market Price'}</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          <strong style={{ color: 'var(--text-title)' }}>{commodity}</strong> • {market} APMC
        </div>
      </div>

      {/* ── Key Market Price Stats ── */}
      <div style={{ padding: '10px 12px 6px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '8px' }}>
        {/* Today's Mandi Modal Price */}
        <div
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: '10px',
            padding: '7px 9px',
          }}
        >
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>
            {isMr ? 'सरासरी बाजारभाव' : 'Mandi Modal Rate'}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-emerald)' }}>
            {fmt(todayPrice)}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{isMr ? 'प्रति क्विंटल' : 'per quintal'}</div>
        </div>

        {/* Per Kg Equivalent (for consumers / general people) */}
        <div
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: '10px',
            padding: '7px 9px',
          }}
        >
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>
            {isMr ? 'अंदाजे दर (प्रति किलो)' : 'Approx. Rate / Kg'}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-title)' }}>
            ₹{perKg}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{isMr ? 'किरकोळ / खरेदी दर' : 'retail / consumer'}</div>
        </div>

        {/* Min - Max Range */}
        {minPrice > 0 && maxPrice > 0 && (
          <div
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: '10px',
              padding: '7px 9px',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>
              {isMr ? 'दर मर्यादा (किमान-कमाल)' : 'Mandi Range'}
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-title)' }}>
              ₹{Math.round(minPrice)} - ₹{Math.round(maxPrice)}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
              (₹{minKg} - ₹{maxKg} /kg)
            </div>
          </div>
        )}
      </div>

      {/* ── 5-Day Trend & Forecast Chips ── */}
      {dailyForecasts.length > 0 && (
        <div style={{ padding: '4px 12px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {isMr ? '📅 पुढील ५ दिवसांचे अपेक्षित भाव:' : '📅 5-Day Mandi Forecast:'}
            </span>
            <span
              style={{
                fontSize: '0.63rem',
                fontWeight: 700,
                color: trend === 'RISING' ? '#4ade80' : trend === 'FALLING' ? '#f87171' : 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              {trend === 'RISING' ? <TrendingUp size={11} /> : trend === 'FALLING' ? <TrendingDown size={11} /> : <Minus size={11} />}
              {trend === 'RISING' ? (isMr ? 'तेजी' : 'Rising') : trend === 'FALLING' ? (isMr ? 'घसरण' : 'Falling') : (isMr ? 'स्थिर' : 'Stable')}
              {changePct ? ` (${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%)` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
            {dailyForecasts.slice(0, 5).map((d, i) => {
              const price = d.predicted_modal_price || 0;
              const dKg = (price / 100).toFixed(0);
              const dayLabel = isMr
                ? (i === 0 ? 'उद्या' : i === 1 ? 'परवा' : `दिवस ${i + 1}`)
                : (i === 0 ? 'Tmrw' : `Day ${i + 1}`);
              return (
                <div
                  key={i}
                  style={{
                    flex: '1 1 0',
                    minWidth: '52px',
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#f3f4f6',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                    borderRadius: '6px',
                    padding: '4px 5px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.57rem', color: 'var(--text-muted)' }}>{dayLabel}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-title)' }}>₹{Math.round(price)}</div>
                  <div style={{ fontSize: '0.58rem', color: 'var(--text-emerald)', fontWeight: 600 }}>₹{dKg}/kg</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Optional Farmer Selling Advice Collapsible ── */}
      <div
        style={{
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          padding: '6px 12px 7px',
          background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <button
          type="button"
          onClick={() => setShowFarmerAdvice((s) => !s)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '2px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '0.67rem',
            fontWeight: 700,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Sprout size={12} color="var(--text-emerald)" />
            {isMr ? '🌾 शेतकरी असल्यास: विक्री सल्ला पहा' : '🌾 For Farmers: Timing Decision'}
          </span>
          <span style={{ fontSize: '0.63rem', color: decisionColor, fontWeight: 800 }}>
            {decisionLabel} {showFarmerAdvice ? '▲' : '▼'}
          </span>
        </button>

        {showFarmerAdvice && (
          <div
            style={{
              marginTop: '6px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: decisionBg,
              border: `1px solid ${decisionBorder}`,
              fontSize: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontWeight: 800, color: decisionColor }}>
                {decisionLabel}
              </span>
              {actByDate && (
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  {isMr ? 'शेवटची तारीख: ' : 'Act by: '}
                  {new Date(actByDate).toLocaleDateString(isMr ? 'mr-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            {reasonText && (
              <div style={{ color: 'var(--text-body)', lineHeight: 1.4, fontSize: '0.68rem' }}>
                {reasonText}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getPriceSpokenText(msg, isMr) {
  if (!msg.priceData) return msg.text || '';
  const d = msg.priceData;
  const price =
    d.last_observed_price ||
    d.price_forecast?.summary?.last_observed_price ||
    d.price_forecast?.daily_forecasts?.[0]?.predicted_modal_price ||
    0;
  const perKg = price > 0 ? (price / 100).toFixed(0) : 0;
  const daily0 = d.price_forecast?.daily_forecasts?.[0];
  const minPrice = daily0?.typical_daily_spread_min || daily0?.predicted_min_price || d.price_forecast?.summary?.min_forecast_price;
  const maxPrice = daily0?.typical_daily_spread_max || daily0?.predicted_max_price || d.price_forecast?.summary?.max_forecast_price;
  const minKg = minPrice > 0 ? (minPrice / 100).toFixed(0) : null;
  const maxKg = maxPrice > 0 ? (maxPrice / 100).toFixed(0) : null;
  const trend = d.price_forecast?.summary?.overall_trend || d.price_forecast?.summary?.price_trend || 'STABLE';

  const trendText = isMr
    ? trend === 'RISING'
      ? 'बाजारात भाव वाढण्याचा अंदाज आहे.'
      : trend === 'FALLING'
      ? 'बाजारात भाव घसरण्याचा अंदाज आहे.'
      : 'बाजारात भाव स्थिर राहण्याचा अंदाज आहे.'
    : trend === 'RISING'
    ? 'Market trend is rising.'
    : trend === 'FALLING'
    ? 'Market trend is falling.'
    : 'Market trend is stable.';

  if (isMr) {
    let s = `${msg.commodity || 'शेतमाल'}चा ${msg.market || ''} कृषी उत्पन्न बाजार समितीत आजचा सरासरी भाव अंदाजे ${Math.round(price)} रुपये प्रति क्विंटल, म्हणजेच ${perKg} रुपये किलो आहे.`;
    if (minKg && maxKg) {
      s += ` दर मर्यादा ${minKg} ते ${maxKg} रुपये किलो दरम्यान आहे.`;
    }
    s += ` ${trendText}`;
    return s;
  } else {
    let s = `In ${msg.market || ''} APMC mandi, today's average market price for ${msg.commodity || 'crop'} is approximately ₹${Math.round(price)} per quintal, which is ₹${perKg} per kg.`;
    if (minKg && maxKg) {
      s += ` The rate ranges between ₹${minKg} and ₹${maxKg} per kg.`;
    }
    s += ` ${trendText}`;
    return s;
  }
}

/* ─────────────────────────────────────────────
   MAIN FLOATING CHATBOT WIDGET
───────────────────────────────────────────── */
export default function AiAssistantDrawer({
  isOpen,
  onClose,
  lang = 'mr',
  setLang,
  theme = 'dark',
  formData = null,          // ← current user crop/market selection from App
}) {
  const isDark = theme === 'dark';
  const isMr = lang === 'mr';

  const welcomeMsg = () => ({
    id: `w-${Date.now()}`,
    role: 'assistant',
    type: 'text',
    text: lang === 'mr'
      ? 'नमस्कार! 🙏 मी **AgriSense AI कृषी मित्र** आहे.\n\nशेती, पिके, बाजारभाव किंवा कीड नियंत्रणाबद्दल विचारा. बाजारभाव विचारल्यास लाइव्ह डेटा कार्डमध्ये दाखवेन!'
      : 'Hello! 🙏 I\'m your **AgriSense AI Assistant**.\n\nAsk about crops, mandi prices, pests or schemes. Price queries show live data cards!',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const [messages, setMessages] = useState([welcomeMsg()]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState(null);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const inputRef = useRef(null);

  // Quick chips
  const quickPrompts = isMr
    ? ['टोमॅटो भाव', 'कांदा बाजारभाव', 'टोमॅटो कीड', 'PM-किसान', 'ठिबक अनुदान']
    : ['Tomato price', 'Onion market rate', 'Tomato pest control', 'PM-KISAN', 'Drip subsidy'];

  // Scroll on new message
  useEffect(() => {
    if (isOpen) setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [messages, loading, isOpen]);

  // Focus input
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  // Reset welcome on lang change
  useEffect(() => { setMessages([welcomeMsg()]); }, [lang]);

  // Setup speech APIs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('speechSynthesis' in window) synthRef.current = window.speechSynthesis;
    else setSpeechSupported(false);

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      try {
        const r = new SR();
        r.continuous = false; r.interimResults = true;
        r.onstart = () => { setIsListening(true); setMicError(null); };
        r.onresult = (e) => {
          let t = '';
          for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
          setInput(t);
        };
        r.onerror = (e) => {
          setIsListening(false);
          if (e.error === 'not-allowed') setMicError(isMr ? 'मायक्रोफोन परवानगी द्या.' : 'Allow microphone access.');
        };
        r.onend = () => setIsListening(false);
        recognitionRef.current = r;
      } catch { setMicSupported(false); }
    } else { setMicSupported(false); }

    return () => synthRef.current?.cancel?.();
  }, [isMr]);

  // TTS
  const cleanForSpeech = (t) => t
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '').replace(/[-*•]\s+/g, '').replace(/\s+/g, ' ').trim();

  const handleSpeak = (msgId, text) => {
    if (!synthRef.current || !text) return;
    if (speakingMsgId === msgId) { synthRef.current.cancel(); setSpeakingMsgId(null); return; }
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(cleanForSpeech(text));
    const isMrContent = lang === 'mr' || /[\u0900-\u097F]/.test(text);
    utt.lang = isMrContent ? 'mr-IN' : 'en-IN'; utt.rate = 0.95;
    const voices = synthRef.current.getVoices?.() || [];
    if (voices.length) {
      const mr = voices.find(v => v.lang.toLowerCase().includes('mr'));
      const hi = voices.find(v => v.lang.toLowerCase().includes('hi'));
      const enIN = voices.find(v => v.lang.toLowerCase().includes('en-in'));
      if (isMrContent && mr) utt.voice = mr;
      else if (isMrContent && hi) utt.voice = hi;
      else if (!isMrContent && enIN) utt.voice = enIN;
    }
    utt.onstart = () => setSpeakingMsgId(msgId);
    utt.onend = utt.onerror = () => setSpeakingMsgId(null);
    synthRef.current.speak(utt);
  };

  const stopSpeaking = () => { synthRef.current?.cancel(); setSpeakingMsgId(null); };

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); }
    else { stopSpeaking(); try { recognitionRef.current.lang = lang === 'mr' ? 'mr-IN' : 'en-IN'; recognitionRef.current.start(); } catch {} }
  };

  const handleSend = async (customText) => {
    const text = typeof customText === 'string' ? customText : input;
    if (!text.trim() || loading || priceLoading) return;
    if (isListening) recognitionRef.current?.stop();

    const userMsg = {
      id: `u-${Date.now()}`, role: 'user', type: 'text',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(p => [...p, userMsg]);
    setInput('');

    // ── PRICE QUERY: fetch live data card ──
    if (isPriceQuery(text)) {
      setPriceLoading(true);
      const priceResult = await fetchPriceAdvisoryForChat(text, formData);
      setPriceLoading(false);

      if (priceResult?.type === 'price_result') {
        const lower = text.toLowerCase();
        const farmerIntent = ['विकावा', 'राखावा', 'ठेवावा', 'कधी विकावे', 'विकू का', 'विक्री सल्ला', 'होल्ड', 'सेल', 'sell', 'hold', 'when to sell', 'timing', 'distress'].some(k => lower.includes(k));

        // Show a brief text + price card together
        const aiMsg = {
          id: `a-${Date.now()}`, role: 'assistant', type: 'price_result',
          text: isMr
            ? `**${priceResult.commodity}** - **${priceResult.market}** बाजार समितीचा आजचा थेट भाव:`
            : `Live **${priceResult.commodity}** market rate for **${priceResult.market}** APMC:`,
          priceData: priceResult.data,
          commodity: priceResult.commodity,
          market: priceResult.market,
          isFarmerIntent: farmerIntent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(p => [...p, aiMsg]);
        if (autoSpeak) {
          const speakTxt = getPriceSpokenText(aiMsg, isMr);
          setTimeout(() => handleSpeak(aiMsg.id, speakTxt), 250);
        }
        return;
      }
      // If price fetch fails, fall through to Gemini
    }

    // ── NORMAL QUERY: Gemini AI ──
    setLoading(true);
    try {
      const history = messages.slice(-4).map(m => ({ role: m.role, text: m.text }));
      const res = await askAgriAssistant({ message: text.trim(), language: lang, history, formData });
      const aiMsg = {
        id: `a-${Date.now()}`, role: 'assistant', type: 'text',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(p => [...p, aiMsg]);
      if (autoSpeak) setTimeout(() => handleSpeak(aiMsg.id, aiMsg.text), 250);
    } catch {
      setMessages(p => [...p, {
        id: `e-${Date.now()}`, role: 'assistant', type: 'text', isError: true,
        text: isMr ? 'माफ करा, त्रुटी आली. पुन्हा प्रयत्न करा.' : 'Sorry, an error occurred. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally { setLoading(false); }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => { stopSpeaking(); setMessages([welcomeMsg()]); };

  if (!isOpen) return null;

  const boxH = expanded ? 580 : 460;

  return (
    <>
      <div
        id="agri-chatbot-box"
        style={{
          position: 'fixed',
          bottom: '88px',
          right: '20px',
          width: 'min(390px, calc(100vw - 32px))',
          height: `${boxH}px`,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          overflow: 'hidden',
          background: isDark ? '#0e1410' : '#ffffff',
          border: `1.5px solid ${isDark ? 'rgba(131,170,70,0.35)' : 'rgba(65,97,27,0.22)'}`,
          boxShadow: isDark
            ? '0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(131,170,70,0.12)'
            : '0 24px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(65,97,27,0.08)',
          animation: 'chatPopIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          transformOrigin: 'bottom right',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 13px', background: 'var(--emerald-gradient)', flexShrink: 0 }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative',
          }}>
            <Bot size={19} color="#fff" />
            <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', border: '2px solid #fff', boxShadow: '0 0 5px #4ade80' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
              {isMr ? 'AI कृषी मित्र' : 'AgriSense AI'}
            </div>
            <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Sparkles size={9} />
              {isMr ? 'Gemini 3.5 • लाइव्ह बाजारभाव + सल्ला' : 'Gemini 3.5 • Live Mandi Prices + Advice'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Lang */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '7px', padding: '2px' }}>
              {['mr', 'en'].map(l => (
                <button key={l} type="button" onClick={() => setLang(l)} style={{
                  background: lang === l ? 'rgba(255,255,255,0.3)' : 'transparent',
                  color: '#fff', border: 'none', borderRadius: '5px',
                  padding: '2px 7px', fontSize: '0.67rem', fontWeight: 700, cursor: 'pointer',
                }}>
                  {l === 'mr' ? 'मराठी' : 'EN'}
                </button>
              ))}
            </div>
            {/* Expand */}
            <button type="button" onClick={() => setExpanded(e => !e)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '7px', width: '27px', height: '27px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
              {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            {/* Clear */}
            <button type="button" onClick={handleClear} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '7px', width: '27px', height: '27px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
              <RotateCcw size={13} />
            </button>
            {/* Close */}
            <button type="button" onClick={() => { stopSpeaking(); onClose(); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '7px', width: '27px', height: '27px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Auto-speak bar ── */}
        {speechSupported && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 12px',
            background: isDark ? 'rgba(131,170,70,0.06)' : 'rgba(65,97,27,0.04)',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sprout size={10} color="var(--text-emerald)" />
              {isMr ? 'फक्त शेती प्रश्न' : 'Agriculture only'}
              {formData?.commodity && (
                <span style={{ color: 'var(--text-emerald)', fontWeight: 700 }}>
                  {' '}• {formData.commodity} | {formData.market}
                </span>
              )}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.63rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} style={{ accentColor: '#83aa46', cursor: 'pointer' }} />
              {isMr ? 'आपोआप ऐका' : 'Auto-read'}
            </label>
          </div>
        )}

        {/* ── Messages ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px',
          display: 'flex', flexDirection: 'column', gap: '10px',
          scrollbarWidth: 'thin', scrollbarColor: 'rgba(131,170,70,0.3) transparent',
        }}>
          {messages.map(msg => {
            const isUser = msg.role === 'user';
            const isSpeaking = speakingMsgId === msg.id;

            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: '3px' }}>
                {/* Meta row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.62rem', color: 'var(--text-muted)', paddingLeft: isUser ? 0 : '2px' }}>
                  {!isUser && <Bot size={10} color="var(--text-emerald)" />}
                  <span>{msg.timestamp}</span>
                  {!isUser && speechSupported && !msg.isError && (msg.type === 'text' || msg.type === 'price_result') && (
                    <button type="button" onClick={() => handleSpeak(msg.id, msg.type === 'price_result' ? getPriceSpokenText(msg, isMr) : msg.text)}
                      style={{
                        background: isSpeaking ? 'var(--emerald-gradient)' : 'transparent',
                        color: isSpeaking ? '#fff' : 'var(--text-emerald)',
                        border: `1px solid ${isSpeaking ? 'transparent' : 'var(--border-highlight)'}`,
                        borderRadius: '5px', padding: '1px 5px',
                        fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                      }}>
                      {isSpeaking ? <VolumeX size={9} /> : <Volume2 size={9} />}
                      {isSpeaking ? (isMr ? 'थांबवा' : 'Stop') : (isMr ? 'ऐका' : 'Listen')}
                      {isSpeaking && <><span className="cb-wave w1" /><span className="cb-wave w2" /><span className="cb-wave w3" /></>}
                    </button>
                  )}
                  {!isUser && msg.type === 'text' && (
                    <button type="button" onClick={() => handleCopy(msg.id, msg.text)}
                      style={{ background: 'transparent', border: 'none', color: copiedId === msg.id ? 'var(--text-emerald)' : 'var(--text-muted)', cursor: 'pointer', padding: '1px', display: 'inline-flex', alignItems: 'center' }}>
                      {copiedId === msg.id ? <Check size={10} /> : <Copy size={10} />}
                    </button>
                  )}
                </div>

                {/* Bubble / Price Card */}
                {msg.type === 'price_result' ? (
                  <div style={{ maxWidth: '100%', width: '100%' }}>
                    {msg.text && (
                      <div style={{
                        fontSize: '0.78rem', color: 'var(--text-body)', marginBottom: '6px',
                        paddingLeft: '2px', fontWeight: 600,
                      }}>{msg.text}</div>
                    )}
                    <PriceMiniCard
                      data={msg.priceData}
                      commodity={msg.commodity}
                      market={msg.market}
                      lang={lang}
                      theme={theme}
                      isFarmerIntent={msg.isFarmerIntent}
                    />
                  </div>
                ) : (
                  <div style={{
                    maxWidth: '88%',
                    padding: '8px 11px',
                    borderRadius: isUser ? '15px 15px 4px 15px' : '15px 15px 15px 4px',
                    background: isUser
                      ? 'var(--emerald-gradient)'
                      : isDark ? 'rgba(255,255,255,0.05)' : '#f4f7f2',
                    color: isUser ? '#fff' : 'var(--text-main)',
                    fontSize: '0.82rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    border: isUser ? 'none'
                      : `1px solid ${isSpeaking ? 'rgba(131,170,70,0.4)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                    boxShadow: isUser ? '0 3px 10px rgba(65,97,27,0.28)' : '0 1px 3px rgba(0,0,0,0.07)',
                  }}>
                    {msg.text}
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing / Loading */}
          {(loading || priceLoading) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'var(--emerald-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {priceLoading ? <BarChart3 size={13} color="#fff" /> : <Bot size={13} color="#fff" />}
              </div>
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f4f7f2',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                borderRadius: '13px', padding: '9px 13px',
                display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '0.74rem', color: 'var(--text-muted)',
              }}>
                <span className="cb-dot d1" /><span className="cb-dot d2" /><span className="cb-dot d3" />
                <span style={{ marginLeft: '4px' }}>
                  {priceLoading
                    ? (isMr ? 'AgriSense मधून लाइव्ह भाव आणत आहे...' : 'Fetching live price from AgriSense...')
                    : (isMr ? 'विचार करत आहे...' : 'Thinking...')}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Quick Chips ── */}
        <div style={{
          padding: '5px 10px',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`,
          display: 'flex', gap: '6px', overflowX: 'auto',
          flexShrink: 0, scrollbarWidth: 'none',
        }}>
          {quickPrompts.map((p, i) => (
            <button key={i} type="button" onClick={() => handleSend(p)} disabled={loading || priceLoading}
              style={{
                background: isDark ? 'rgba(131,170,70,0.09)' : 'rgba(65,97,27,0.06)',
                color: 'var(--text-emerald)',
                border: '1px solid rgba(131,170,70,0.22)',
                borderRadius: '14px', padding: '3px 10px',
                fontSize: '0.69rem', fontWeight: 600,
                cursor: loading || priceLoading ? 'not-allowed' : 'pointer',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
              {p}
            </button>
          ))}
        </div>

        {/* Mic error */}
        {micError && (
          <div style={{ padding: '4px 12px', fontSize: '0.68rem', color: 'var(--text-red)', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <AlertCircle size={11} />{micError}
          </div>
        )}

        {/* Listening banner */}
        {isListening && (
          <div style={{
            padding: '5px 12px', flexShrink: 0,
            background: 'rgba(239,68,68,0.1)', borderTop: '1px solid rgba(239,68,68,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', animation: 'cbPulse 1s infinite' }} />
              {isMr ? '🎙️ ऐकत आहे...' : '🎙️ Listening...'}
            </span>
            <button type="button" onClick={toggleMic} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '5px', padding: '2px 8px', fontSize: '0.67rem', fontWeight: 700, cursor: 'pointer' }}>
              {isMr ? 'पूर्ण' : 'Done'}
            </button>
          </div>
        )}

        {/* ── Input Bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '9px 10px 12px',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
          background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(248,252,248,0.95)',
          flexShrink: 0,
        }}>
          {micSupported && (
            <button type="button" onClick={toggleMic} style={{
              width: '34px', height: '34px', flexShrink: 0, borderRadius: '10px',
              background: isListening ? 'rgba(239,68,68,0.15)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              color: isListening ? '#ef4444' : 'var(--text-muted)',
              border: isListening ? '1px solid rgba(239,68,68,0.4)' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isMr ? 'भाव, पीक, कीड विचारा...' : 'Ask price, crop, pest...'}
            disabled={loading || priceLoading}
            style={{
              flex: 1, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
              borderRadius: '10px', padding: '8px 11px',
              color: 'var(--text-title)', fontSize: '0.81rem', outline: 'none', minWidth: 0,
            }}
          />

          <button type="button" onClick={() => handleSend()} disabled={!input.trim() || loading || priceLoading}
            style={{
              width: '34px', height: '34px', flexShrink: 0, borderRadius: '10px',
              background: !input.trim() || loading || priceLoading
                ? isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                : 'var(--emerald-gradient)',
              color: !input.trim() || loading || priceLoading ? 'var(--text-muted)' : '#fff',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: !input.trim() || loading || priceLoading ? 'not-allowed' : 'pointer',
              boxShadow: !input.trim() || loading || priceLoading ? 'none' : '0 3px 12px rgba(65,97,27,0.4)',
            }}>
            <Send size={15} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes chatPopIn {
          from { opacity:0; transform:scale(0.82) translateY(18px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes cbPulse {
          0%   { transform:scale(1); box-shadow:0 0 0 0 rgba(239,68,68,.7); }
          70%  { transform:scale(1.1); box-shadow:0 0 0 5px rgba(239,68,68,0); }
          100% { transform:scale(1); box-shadow:0 0 0 0 rgba(239,68,68,0); }
        }
        .cb-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--text-emerald); animation:cbBlink 1.2s infinite ease-in-out; }
        .d1{animation-delay:0s;} .d2{animation-delay:.2s;} .d3{animation-delay:.4s;}
        @keyframes cbBlink { 0%,80%,100%{opacity:.2;transform:scale(.8);} 40%{opacity:1;transform:scale(1.2);} }
        .cb-wave{display:inline-block;width:2px;border-radius:2px;background:#fff;animation:cbWave .75s ease-in-out infinite alternate;}
        .w1{height:4px;animation-delay:.1s;} .w2{height:9px;animation-delay:.25s;} .w3{height:6px;animation-delay:.15s;}
        @keyframes cbWave{from{height:2px;}to{height:10px;}}
        #agri-chatbot-box ::-webkit-scrollbar{width:3px;}
        #agri-chatbot-box ::-webkit-scrollbar-thumb{background:rgba(131,170,70,0.3);border-radius:3px;}
        @media(max-width:480px){
          #agri-chatbot-box{right:8px!important;width:calc(100vw - 16px)!important;bottom:76px!important;}
        }
      `}</style>
    </>
  );
}
