import { ConversationModel } from '../models/conversationModel.js';
import { MessageModel } from '../models/messageModel.js';
import { UserModel } from '../models/userModel.js';
import { aiService } from '../services/aiService.js';

export const chatController = {
  /**
   * Main chat message handler.
   * Handles multi-turn conversation with Mistral AI, contextual history, recaps, and suggestions.
   */
  async sendMessage(req, res, next) {
    try {
      const { conversationId, message, mode = 'explain', action = null } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message content is required.' });
      }

      let convId = conversationId || Date.now();
      let history = [];
      let userMessage = { role: 'user', content: message.trim(), mode };
      let userLevel = 'beginner';

      try {
        // 1. Verify or create conversation
        if (conversationId) {
          const existingConv = await ConversationModel.findById(conversationId);
          if (existingConv && existingConv.user_id !== req.user?.userId) {
            return res.status(403).json({ error: 'You do not have permission to access this conversation.' });
          }
        } else {
          // Auto-create new conversation
          const title = message.trim().slice(0, 40);
          const newConv = await ConversationModel.create({
            userId: req.user?.userId || 1,
            title,
          });
          convId = newConv.id;
        }

        // 2. Fetch context history BEFORE saving the new message
        history = await MessageModel.getRecentHistory(convId, 15);

        // 3. Save user message to database
        userMessage = await MessageModel.create({
          conversationId: convId,
          role: 'user',
          content: message.trim(),
          mode,
        });

        // 4. Fetch user learning level
        if (req.user?.userId) {
          const user = await UserModel.findById(req.user.userId);
          if (user) userLevel = user.level || 'beginner';
        }
      } catch (dbErr) {
        console.warn('Database unavailable, skipping DB reads/writes for user message:', dbErr.message);
      }

      // 5. Generate AI pedagogical response via Mistral
      const aiResult = await aiService.getExplanation({
        history,
        newMessage: message.trim(),
        userLevel,
        mode,
        action,
      });

      const responseContent = typeof aiResult === 'string' ? aiResult : aiResult.content;
      const suggestedNextPrompt = typeof aiResult === 'object' ? aiResult.suggestedNextPrompt : null;

      // 6. Save AI message to database (or mock if DB offline)
      let aiMessage = { role: 'ai', content: responseContent, mode };
      try {
        aiMessage = await MessageModel.create({
          conversationId: convId,
          role: 'ai',
          content: responseContent,
          mode,
        });
      } catch (dbErr) {
        console.warn('Database unavailable, skipping DB write for AI message:', dbErr.message);
      }

      res.status(201).json({
        success: true,
        conversationId: convId,
        userMessage,
        aiMessage,
        suggestedNextPrompt,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Dedicated recap endpoint for a conversation
   */
  async getRecap(req, res, next) {
    try {
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required.' });
      }

      let history = [];
      let conversationIdNum = parseInt(conversationId, 10) || Date.now();
      
      try {
        const existingConv = await ConversationModel.findById(conversationId);
        if (existingConv && existingConv.user_id !== req.user?.userId) {
          return res.status(403).json({ error: 'You do not have permission to access this conversation.' });
        }
        history = await MessageModel.listByConversation(conversationId);
      } catch (dbErr) {
        console.warn('Database unavailable, skipping DB read for recap:', dbErr.message);
      }

      const recapResult = await aiService.getRecap({ history });

      res.json({
        success: true,
        conversationId: conversationIdNum,
        recap: recapResult.content,
        suggestedNextPrompt: recapResult.suggestedNextPrompt,
      });
    } catch (err) {
      next(err);
    }
  },
};
