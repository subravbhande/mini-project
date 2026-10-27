const express = require("express");
const router = express.Router();
const { generateAgriAdvice } = require("../services/geminiService");

/**
 * POST /api/assistant/chat
 * Ask AgriSense AI Assistant an agriculture question
 * Body: { message: string, language?: 'mr'|'en', history?: Array }
 */
router.post("/chat", async (req, res) => {
  try {
    const { message, language = "mr", history = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required and cannot be empty.",
      });
    }

    const result = await generateAgriAdvice({
      message: message.trim(),
      language: language === "en" ? "en" : "mr",
      history: Array.isArray(history) ? history : [],
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Assistant Route Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to process question with AI Assistant.",
    });
  }
});

module.exports = router;
