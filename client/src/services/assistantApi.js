import axios from "axios";

const LIVE_BACKEND_URL = "https://agrisense-backend-7pza.onrender.com";

let configuredUrl = import.meta.env.VITE_API_URL || "";
if (configuredUrl.includes("ml-service")) {
  configuredUrl = LIVE_BACKEND_URL;
}

const BASE_URL =
  configuredUrl ||
  (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")
    ? LIVE_BACKEND_URL
    : "http://localhost:5000");
const CLIENT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const CANDIDATE_MODELS = [
  "models/gemini-3.1-flash-lite",
  "models/gemini-3.5-flash",
  "models/gemini-3.6-flash",
  "models/gemini-3.1-flash-lite-preview",
  "models/gemini-3-flash-preview",
  "models/gemini-flash-lite-latest",
];

// In-memory cache for fast price queries
const priceCache = new Map();

/* ─────────────────────────────────────────────────────────
   PRICE QUERY DETECTION
   Detect if the user is asking about price / sell decision
───────────────────────────────────────────────────────── */

const PRICE_KEYWORDS_MR = [
  'भाव', 'किंमत', 'बाजारभाव', 'विकावा', 'राखावा', 'ठेवावा', 'APMC', 'मंडी',
  'आजचा दर', 'दर', 'आज', 'उद्या', 'नफा', 'विक्री', 'कोणती वेळ', 'कधी विकावे',
  'फायदा', 'तोटा', 'किती भाव', 'सल्ला', 'बाजार', 'forecast', 'होल्ड', 'सेल',
];
const PRICE_KEYWORDS_EN = [
  'price', 'rate', 'mandi', 'apmc', 'sell', 'hold', 'forecast', 'today',
  'market price', 'worth', 'selling', 'profit', 'when to sell', 'best time',
  'market rate', 'current price', 'advisory', 'should i sell', 'cost',
];

// Crop alias mapping (Marathi / common names → API commodity name)
const CROP_ALIASES = {
  'टोमॅटो': 'Tomato', 'tomato': 'Tomato', 'tamatar': 'Tomato',
  'कांदा': 'Onion', 'onion': 'Onion', 'kanda': 'Onion',
  'सोयाबीन': 'Soybean', 'soybean': 'Soybean', 'soya': 'Soybean',
  'कापूस': 'Cotton', 'cotton': 'Cotton',
  'ऊस': 'Sugarcane', 'sugarcane': 'Sugarcane', 'us': 'Sugarcane',
  'हळद': 'Turmeric', 'turmeric': 'Turmeric', 'haldi': 'Turmeric',
  'डाळिंब': 'Pomegranate', 'pomegranate': 'Pomegranate',
  'द्राक्षे': 'Grapes', 'grapes': 'Grapes', 'draksha': 'Grapes',
  'गहू': 'Wheat', 'wheat': 'Wheat',
  'हरभरा': 'Gram', 'gram': 'Gram', 'chana': 'Gram',
};

// Market alias mapping
const MARKET_ALIASES = {
  'कोल्हापूर': 'Kolhapur', 'kolhapur': 'Kolhapur',
  'सांगली': 'Sangli', 'sangli': 'Sangli',
  'नाशिक': 'Nashik', 'nashik': 'Nashik', 'nasik': 'Nashik',
  'पुणे': 'Pune', 'pune': 'Pune',
  'सोलापूर': 'Solapur', 'solapur': 'Solapur',
  'औरंगाबाद': 'Aurangabad', 'aurangabad': 'Aurangabad',
  'नागपूर': 'Nagpur', 'nagpur': 'Nagpur',
};

/**
 * Check if the query is price/decision-related
 */
export function isPriceQuery(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    PRICE_KEYWORDS_MR.some(k => lower.includes(k.toLowerCase())) ||
    PRICE_KEYWORDS_EN.some(k => lower.includes(k.toLowerCase()))
  );
}

/**
 * Extract commodity and market from the query text
 * Falls back to provided defaults from app formData
 */
function extractCropAndMarket(message, defaultFormData) {
  const lower = message.toLowerCase();

  let commodity = defaultFormData?.commodity || 'Tomato';
  let market = defaultFormData?.market || 'Kolhapur';
  let district = defaultFormData?.district || 'Kolhapur';

  // Try to detect crop
  for (const [alias, canonical] of Object.entries(CROP_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) {
      commodity = canonical;
      break;
    }
  }

  // Try to detect market
  for (const [alias, canonical] of Object.entries(MARKET_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) {
      market = canonical;
      district = canonical;
      break;
    }
  }

  return { commodity, market, district };
}

/**
 * Fetch price advisory from the AgriSense backend
 */
export async function fetchPriceAdvisoryForChat(message, formData) {
  const { commodity, market, district } = extractCropAndMarket(message, formData);
  const cacheKey = `${commodity.toLowerCase()}_${market.toLowerCase()}`;

  // 1. Check if the main app already computed result for this crop & market
  if (
    formData?.activeResult &&
    String(formData?.commodity || '').toLowerCase() === commodity.toLowerCase() &&
    String(formData?.market || '').toLowerCase() === market.toLowerCase()
  ) {
    return {
      type: 'price_result',
      commodity,
      market,
      district,
      data: formData.activeResult,
    };
  }

  // 2. Check in-memory cache (valid for 5 mins)
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 300000) {
    return cached.result;
  }

  const token = localStorage.getItem("agrisense_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await axios.post(
      `${BASE_URL}/api/decision/evaluate`,
      {
        commodity: commodity.toLowerCase(),
        market,
        district,
        quantityQuintals: Number(formData?.quantity_quintals) || 50,
        storageType: formData?.storage_type || 'ambient',
        liquidityNeed: formData?.liquidity_need || 'normal',
      },
      { headers, timeout: 35000 }
    );
    const data = res.data?.data;
    if (!data) throw new Error('No data returned');
    const resultObj = {
      type: 'price_result',
      commodity,
      market,
      district,
      data,
    };
    priceCache.set(cacheKey, { result: resultObj, timestamp: Date.now() });
    return resultObj;
  } catch (err) {
    // Fall back to price forecast endpoint
    try {
      const res = await axios.post(
        `${BASE_URL}/api/price/forecast`,
        { commodity, market, district, quantity_quintals: 50, horizon_days: 5 },
        { headers, timeout: 35000 }
      );
      const data = res.data?.data;
      if (!data) throw new Error('No forecast data');
      const resultObj = {
        type: 'price_result',
        commodity,
        market,
        district,
        data,
      };
      priceCache.set(cacheKey, { result: resultObj, timestamp: Date.now() });
      return resultObj;
    } catch (e2) {
      return null; // Backend not available, fall through to Gemini
    }
  }
}

/* ─────────────────────────────────────────────────────────
   GEMINI DIRECT FALLBACK (client-side)
───────────────────────────────────────────────────────── */
const AGRI_SYSTEM_PROMPT = `
You are AgriSense AI Assistant (कृषी मित्र), a concise agricultural AI advisor for Indian farmers and citizens.

STRICT RULES:
1. Answer agriculture & produce-related questions: crops, pest/disease control, fertilizers, soil, weather, APMC market prices, vegetable/produce rates, and farming schemes.
2. FOR NON-FARMERS: Even if a user does NOT have a farm (e.g. consumer, buyer, trader) but asks for crop/mandi prices (उदा. टोमॅटो भाव, कांदा भाव), ALWAYS provide the market price (per quintal and per kg) helpfully. Never decline price queries because the user has no farm.
3. For strictly non-agricultural/non-food topics (e.g. movies, coding, cricket): politely decline in the user's language and redirect to agriculture/mandi topics.
4. KEEP ANSWERS SHORT — max 3-4 bullet points or 2-3 short sentences. No long paragraphs.
5. For price/market questions: state the APMC market price and approx per kg rate, and general trend concisely.
6. Use the user's language (Marathi or English).
7. Marathi: simple, friendly Marathi. English: plain simple English.
8. No headers (#). Use - for bullets and **bold** for key words only.
`;

async function callDirectGemini({ message, language = "mr", history = [] }) {
  const effectiveLang = language === "mr" ? "Marathi" : "English";
  const contents = [];

  if (Array.isArray(history) && history.length > 0) {
    for (const h of history.slice(-6)) {
      if (h && h.text) {
        contents.push({
          role: h.role === "assistant" || h.role === "model" ? "model" : "user",
          parts: [{ text: h.text }],
        });
      }
    }
  }

  contents.push({
    role: "user",
    parts: [{ text: `[Language: ${effectiveLang}]\n${message.trim()}` }],
  });

  const body = {
    system_instruction: { parts: [{ text: AGRI_SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.5,
      topP: 0.85,
      maxOutputTokens: 280,
    },
  };

  let lastErr = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${CLIENT_GEMINI_KEY}`;
      const res = await axios.post(url, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 16000,
      });
      const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return { type: 'text', reply: reply.trim(), language, modelUsed: model, source: "direct" };
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(lastErr?.response?.data?.error?.message || lastErr?.message || "AI service unavailable.");
}

/* ─────────────────────────────────────────────────────────
   MAIN: askAgriAssistant
   Routes price queries to backend, others to Gemini
───────────────────────────────────────────────────────── */
export async function askAgriAssistant({ message, language = "mr", history = [], formData = null }) {
  // 1. Try backend for any text-based query first
  try {
    const token = localStorage.getItem("agrisense_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await axios.post(
      `${BASE_URL}/api/assistant/chat`,
      { message, language, history },
      { headers, timeout: 14000 }
    );

    if (res.data?.success && res.data?.data?.reply) {
      return { type: 'text', reply: res.data.data.reply, language };
    }
  } catch {
    // Backend unavailable, fall through
  }

  // 2. Fall back: direct Gemini client call
  return await callDirectGemini({ message, language, history });
}
