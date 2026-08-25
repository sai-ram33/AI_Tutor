import { ConversationModel } from '../models/conversationModel.js';
import { MessageModel } from '../models/messageModel.js';
import { UserModel } from '../models/userModel.js';
import { aiService } from '../services/aiService.js';

export const visionController = {
  /**
   * Explains an uploaded image and text prompt using Qwen2.5-VL-3B-Instruct.
   * Accepts multipart/form-data with 'image' file and 'message' text.
   */
  async processVisionChat(req, res, next) {
    try {
      const { conversationId, message, mode = 'explain' } = req.body;
      const file = req.file;

      // 1. Validation: Message is required
      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Message instruction is required.',
        });
      }

      // 2. Validation: Image file is required for vision endpoint
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'An image file (JPEG, PNG, or WEBP) is required for visual analysis.',
        });
      }

      // 3. Validation: MIME type check
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(file.mimetype.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `Unsupported image format: ${file.mimetype}. Please upload a JPEG, PNG, or WEBP image.`,
        });
      }

      let convId = conversationId;

      // 4. Verify or create conversation in PostgreSQL
      if (convId) {
        const existingConv = await ConversationModel.findById(convId);
        if (!existingConv) {
          return res.status(404).json({
            success: false,
            error: 'Conversation not found.',
          });
        }
        if (existingConv.user_id !== req.user.userId) {
          return res.status(403).json({
            success: false,
            error: 'You do not have permission to access this conversation.',
          });
        }
      } else {
        const title = `[Image] ${message.trim().slice(0, 30)}`;
        const newConv = await ConversationModel.create({
          userId: req.user.userId,
          title,
        });
        convId = newConv.id;
      }

      // 5. Fetch prior conversation history
      const history = await MessageModel.getRecentHistory(convId, 10);

      // 6. Save user message to database
      const userMessage = await MessageModel.create({
        conversationId: convId,
        role: 'user',
        content: `[Uploaded Image: ${file.originalname}] ${message.trim()}`,
        mode,
      });

      // 7. Fetch user learning level
      const user = await UserModel.findById(req.user.userId);
      const userLevel = user?.level || 'beginner';

      // 8. Invoke Qwen Vision Model
      const qwenResult = await aiService.explainImage({
        imageBuffer: file.buffer,
        imageMimetype: file.mimetype,
        imageOriginalName: file.originalname,
        message: message.trim(),
        history,
        userLevel,
        mode,
      });

      // 9. Save AI response to database
      const aiMessage = await MessageModel.create({
        conversationId: convId,
        role: 'ai',
        content: qwenResult.response,
        mode,
      });

      res.status(200).json({
        success: true,
        model: qwenResult.model || 'Qwen/Qwen2.5-VL-3B-Instruct',
        conversationId: convId,
        userMessage,
        aiMessage,
        response: qwenResult.response,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Health check for Qwen Vision service
   */
  async getHealth(req, res, next) {
    try {
      const health = await aiService.checkVisionHealth();
      const statusCode = health.success ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (err) {
      next(err);
    }
  },
};
