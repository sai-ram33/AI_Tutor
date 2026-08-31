import { aiService } from '../services/aiService.js';
import { config } from '../config/env.js';

export const aiController = {
  /**
   * Generates audio from text using Groq TTS API and returns binary audio stream/file
   * POST /api/ai/text-to-audio
   */
  async generateTextToAudio(req, res, next) {
    try {
      const { text, voice, model } = req.body || {};

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Text content is required and must not be empty.',
        });
      }

      const result = await aiService.textToAudio({
        text: text.trim(),
        voice,
        model,
      });

      // Return binary audio stream/file directly for easy Postman / browser testing
      res.set({
        'Content-Type': result.mimeType || 'audio/wav',
        'Content-Length': result.byteLength,
        'Content-Disposition': 'inline; filename="speech.wav"',
        'Cache-Control': 'no-cache',
      });

      return res.status(200).send(result.audioBuffer);
    } catch (err) {
      console.error('[AI Controller TTS Error]:', err.message);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        error: err.message || 'Text-to-audio generation failed.',
      });
    }
  },

  /**
   * Retrieves supported voice personas and configuration info
   * GET /api/ai/voices
   */
  async getVoices(req, res) {
    return res.json({
      success: true,
      currentModel: config.groqTtsModel,
      defaultVoice: config.groqTtsVoice,
      availableVoices: aiService.getTtsVoices(),
    });
  },
};
