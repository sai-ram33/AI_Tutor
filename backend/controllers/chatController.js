import { ConversationModel } from '../models/conversationModel.js';
import { MessageModel } from '../models/messageModel.js';
import { UserModel } from '../models/userModel.js';
import { aiService } from '../services/aiService.js';

export const chatController = {
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

      // 2. Save user message
      const userMessage = await MessageModel.create({
        conversationId: convId,
        role: 'user',
        content: message.trim(),
        mode,
      });

      // 3. Fetch context history & user level
      const history = await MessageModel.getRecentHistory(convId, 10);
      const user = await UserModel.findById(req.user.userId);
      const userLevel = user?.level || 'beginner';

      // 4. Generate AI pedagogical response
      const aiResponseContent = await aiService.getExplanation({
        history,
        newMessage: message.trim(),
        userLevel,
        mode,
        action,
      });

      // 5. Save AI message
      const aiMessage = await MessageModel.create({
        conversationId: convId,
        role: 'ai',
        content: aiResponseContent,
        mode,
      });

      res.status(201).json({
        conversationId: convId,
        userMessage,
        aiMessage,
      });
    } catch (err) {
      next(err);
    }
  },
};
