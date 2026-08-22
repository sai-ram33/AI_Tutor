import { ConversationModel } from '../models/conversationModel.js';
import { MessageModel } from '../models/messageModel.js';

export const conversationController = {
  async list(req, res, next) {
    try {
      const conversations = await ConversationModel.listByUser(req.user.userId);
      res.json({ conversations });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const { title } = req.body;
      const conversation = await ConversationModel.create({
        userId: req.user.userId,
        title: title || 'New Chat',
      });
      res.status(201).json({ conversation });
    } catch (err) {
      next(err);
    }
  },

  async rename(req, res, next) {
    try {
      const { id } = req.params;
      const { title } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty.' });
      }

      // Check ownership
      const existing = await ConversationModel.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
      if (existing.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'You do not have permission to modify this conversation.' });
      }

      const updated = await ConversationModel.updateTitle(id, req.user.userId, title.trim());
      res.json({ conversation: updated });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const { id } = req.params;

      // Check ownership
      const existing = await ConversationModel.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
      if (existing.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'You do not have permission to delete this conversation.' });
      }

      await ConversationModel.delete(id, req.user.userId);
      res.json({ message: 'Conversation deleted successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async getMessages(req, res, next) {
    try {
      const { id } = req.params;

      // Check ownership
      const existing = await ConversationModel.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
      if (existing.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'You do not have permission to access this conversation.' });
      }

      const messages = await MessageModel.listByConversation(id);
      res.json({ messages });
    } catch (err) {
      next(err);
    }
  },
};
