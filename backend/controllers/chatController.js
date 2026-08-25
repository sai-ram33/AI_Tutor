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

      let convId = conversationId;

      // 1. Verify or create conversation
      if (convId) {
        const existingConv = await ConversationModel.findById(convId);
        if (!existingConv) {
          return res.status(404).json({ error: 'Conversation not found.' });
        }
        if (existingConv.user_id !== req.user.userId) {
          return res.status(403).json({ error: 'You do not have permission to access this conversation.' });
        }
      } else {
        // Auto-create new conversation
        const title = message.trim().slice(0, 40);
        const newConv = await ConversationModel.create({
          userId: req.user.userId,
          title,
        });
        convId = newConv.id;
      }

      // 2. Fetch context history BEFORE saving the new message
      // (so we have pristine prior context)
      const history = await MessageModel.getRecentHistory(convId, 15);

      // 3. Save user message to database
      const userMessage = await MessageModel.create({
        conversationId: convId,
        role: 'user',
        content: message.trim(),
        mode,
      });

      // 4. Fetch user learning level
      const user = await UserModel.findById(req.user.userId);
      const userLevel = user?.level || 'beginner';

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

      // 6. Save AI message to database
      const aiMessage = await MessageModel.create({
        conversationId: convId,
        role: 'ai',
        content: responseContent,
        mode,
      });

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

      const existingConv = await ConversationModel.findById(conversationId);
      if (!existingConv) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
      if (existingConv.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'You do not have permission to access this conversation.' });
      }

      const history = await MessageModel.listByConversation(conversationId);
      const recapResult = await aiService.getRecap({ history });

      res.json({
        success: true,
        conversationId: parseInt(conversationId, 10),
        recap: recapResult.content,
        suggestedNextPrompt: recapResult.suggestedNextPrompt,
      });
    } catch (err) {
      next(err);
    }
  },
};
