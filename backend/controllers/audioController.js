import { ConversationModel } from '../models/conversationModel.js';
import { MessageModel } from '../models/messageModel.js';
import { UserModel } from '../models/userModel.js';
import { lfmAudioService } from '../services/ai/audio/lfmAudioService.js';

const ALLOWED_AUDIO_MIMES = [
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/ogg',
  'audio/vorbis',
  'audio/flac',
  'audio/x-flac',
  'audio/webm',
  'audio/aac',
  'audio/x-aac',
  'application/octet-stream',
];

export const audioController = {
  /**
   * Processes conversational audio input using LiquidAI LFM2.5-Audio-1.5B speech-to-speech model.
   * Accepts multipart/form-data with 'audio' file and optional 'message' instruction.
   */
  async processAudioChat(req, res, next) {
    try {
      const { conversationId, message = '', mode = 'explain' } = req.body;
      const file = req.file;

      // 1. Validation: Audio file is required
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'An audio file (WAV, MP3, M4A, OGG, FLAC, or WEBM) is required.',
        });
      }

      // 2. Validation: Empty file check
      if (!file.buffer || file.buffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Uploaded audio file is empty.',
        });
      }

      // 3. Validation: MIME type check
      const mimetype = (file.mimetype || '').toLowerCase();
      const hasValidExt = /\.(wav|mp3|m4a|ogg|flac|webm|aac)$/i.test(file.originalname || '');

      if (!ALLOWED_AUDIO_MIMES.includes(mimetype) && !hasValidExt) {
        return res.status(400).json({
          success: false,
          error: `Unsupported audio format (${file.mimetype}). Please upload a WAV, MP3, M4A, OGG, FLAC, or WEBM audio file.`,
        });
      }

      let convId = conversationId;
      let history = [];
      let userLevel = 'beginner';

      // 4. If authenticated user is present, link with PostgreSQL conversation history
      if (req.user?.userId) {
        try {
          if (convId) {
            const existingConv = await ConversationModel.findById(convId);
            if (existingConv && existingConv.user_id === req.user.userId) {
              history = await MessageModel.getRecentHistory(convId, 8);
            } else if (!existingConv) {
              const newConv = await ConversationModel.create({
                userId: req.user.userId,
                title: `[Audio] ${message ? message.slice(0, 25) : file.originalname}`,
              });
              convId = newConv.id;
            }
          } else {
            const title = `[Audio] ${message ? message.slice(0, 25) : file.originalname}`;
            const newConv = await ConversationModel.create({
              userId: req.user.userId,
              title,
            });
            convId = newConv.id;
          }

          const user = await UserModel.findById(req.user.userId);
          if (user?.level) {
            userLevel = user.level;
          }
        } catch (dbErr) {
          console.warn('[Audio Controller] Database conversation lookup skipped:', dbErr.message);
        }
      }

      // 5. Invoke LFM Audio Foundation Model via lfmAudioService
      const audioResult = await lfmAudioService.processAudio({
        audioBuffer: file.buffer,
        audioMimetype: file.mimetype || 'audio/wav',
        audioOriginalName: file.originalname || 'input.wav',
        message: (message || '').trim(),
        history,
        userLevel,
        mode,
      });

      // 6. Save message turns in PostgreSQL if conversation is active
      let savedUserMessage = null;
      let savedAiMessage = null;

      if (convId && req.user?.userId) {
        try {
          const userText = message && message.trim()
            ? `[Audio Note: ${file.originalname}] ${message.trim()}`
            : `[Audio Note: ${file.originalname}]`;

          savedUserMessage = await MessageModel.create({
            conversationId: convId,
            role: 'user',
            content: userText,
            mode,
          });

          savedAiMessage = await MessageModel.create({
            conversationId: convId,
            role: 'ai',
            content: audioResult.text || '[Audio response generated]',
            mode,
          });
        } catch (msgErr) {
          console.warn('[Audio Controller] Failed to save audio messages to PostgreSQL:', msgErr.message);
        }
      }

      res.status(200).json({
        success: true,
        model: audioResult.model || 'LiquidAI/LFM2.5-Audio-1.5B',
        conversationId: convId || null,
        text: audioResult.text,
        audioBase64: audioResult.audioBase64,
        audioFormat: audioResult.audioFormat || 'wav',
        samplingRate: audioResult.samplingRate || 24000,
        durationSeconds: audioResult.durationSeconds || 0,
        device: audioResult.device || 'unknown',
        isFallback: audioResult.isFallback || false,
        userMessage: savedUserMessage,
        aiMessage: savedAiMessage,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Health check for LFM Audio microservice
   */
  async getHealth(req, res, next) {
    try {
      const health = await lfmAudioService.checkHealth();
      const statusCode = health.success && health.ready ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Returns LFM Audio model metadata and capabilities
   */
  async getModelInfo(req, res, next) {
    try {
      const info = await lfmAudioService.getModelInfo();
      res.status(200).json(info);
    } catch (err) {
      next(err);
    }
  },
};
