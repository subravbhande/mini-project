const axios = require("axios");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const configuredModel = process.env.GEMINI_MODEL
  ? (process.env.GEMINI_MODEL.startsWith('models/') ? process.env.GEMINI_MODEL : 'models/' + process.env.GEMINI_MODEL)
  : null;

const DEFAULT_MODELS = [
  'models/gemini-3.1-flash-lite',
  'models/gemini-3.5-flash',
  'models/gemini-3.6-flash',
  'models/gemini-3.1-flash-lite-preview',
  'models/gemini-3-flash-preview',
  'models/gemini-flash-lite-latest',
];

const CANDIDATE_MODELS = configuredModel
  ? [configuredModel, ...DEFAULT_MODELS.filter((m) => m !== configuredModel)]
  : DEFAULT_MODELS;

const SYSTEM_INSTRUCTION = `
You are AgriSense AI Assistant (कृषी मित्र), a concise agricultural AI advisor for Indian farmers and citizens.

STRICT RULES:
1. Answer agriculture & produce-related questions: crops, pest/disease control, fertilizers, soil, weather impact, APMC market prices, vegetable/produce rates, and farming schemes.
2. FOR NON-FARMERS / CONSUMERS: Even if a user mentions they do NOT have a farm or are just an ordinary buyer/citizen wanting to know crop or market prices (उदा. टोमॅटो भाव, कांदा भाव), ALWAYS provide the market price (per quintal and approx. per kg) helpfully. Never reject price queries because the user has no farm.
3. For strictly non-agricultural/non-food topics (e.g. movies, coding, cricket, politics): politely decline in the user's language and redirect to farming and market prices.
4. KEEP ANSWERS SHORT AND CONCISE — maximum 3-4 short bullet points or 2-3 sentences. Never write long paragraphs.
5. FOR PRICE/MARKET QUESTIONS: AgriSense primarily covers BOTH Kolhapur and Sangli APMC markets in Maharashtra (Tomato: Kolhapur and Islampur; Onion: Kolhapur and Sangli-Phale-Bhajipala). ALWAYS state the APMC rates for BOTH Kolhapur and Sangli markets (per quintal and approx per kg) and the general trend concisely. The live data card will also display both markets.
6. Use the user's language (Marathi or English) throughout.
7. Marathi: use simple, friendly Marathi. English: use plain simple English.
8. No markdown headers (#). Use only short bullet points (- ) and **bold** for key words.
`;

/**
 * Ask Gemini with agricultural guardrails and multi-turn history
 * @param {Object} options
 * @param {string} options.message - The current user question
 * @param {string} options.language - 'mr' (Marathi) or 'en' (English)
 * @param {Array} [options.history] - Array of previous messages [{ role: 'user'|'model', text: '...' }]
 */
async function generateAgriAdvice({ message, language = "mr", history = [] }) {
  if (!message || !message.trim()) {
    throw new Error("Message cannot be empty.");
  }

  const effectiveLang = language === "mr" ? "Marathi" : "English";

  // Build Gemini contents array
  const contents = [];

  // Add previous conversational turns (up to last 8 turns for context)
  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-8);
    for (const item of recentHistory) {
      if (item && item.text) {
        const role = item.role === "assistant" || item.role === "model" ? "model" : "user";
        contents.push({
          role,
          parts: [{ text: item.text }],
        });
      }
    }
  }

  // Ensure current user message is appended with language hint
  const userPromptWithLangHint = `[Selected Language: ${effectiveLang}]\n${message.trim()}`;
  contents.push({
    role: "user",
    parts: [{ text: userPromptWithLangHint }],
  });

  const requestBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents,
    generationConfig: {
      temperature: 0.5,
      topP: 0.85,
      maxOutputTokens: 800,  // Keep answers short for chatbot UI
    },
  };

  let lastError = null;

  // Attempt models in candidate list for high availability
  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await axios.post(url, requestBody, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 15000,
      });

      const candidate = response.data?.candidates?.[0];
      const replyText = candidate?.content?.parts?.[0]?.text;

      if (replyText && replyText.trim()) {
        return {
          reply: replyText.trim(),
          language: language || "mr",
          modelUsed: model,
        };
      }
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error?.message || err.message;
      console.warn(`[GeminiService] Model ${model} failed (${status}): ${errorMsg}`);
      lastError = err;
      // Try next model in list
    }
  }

  throw new Error(
    lastError?.response?.data?.error?.message ||
    lastError?.message ||
    "Unable to generate response from Gemini AI. Please check network connection or try again."
  );
}

module.exports = {
  generateAgriAdvice,
  GEMINI_API_KEY,
  SYSTEM_INSTRUCTION,
};
