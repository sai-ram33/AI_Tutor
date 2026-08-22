import { query } from '../config/db.js';

export const MessageModel = {
  async create({ conversationId, role, content, mode = 'explain' }) {
    const res = await query(
      `INSERT INTO messages (conversation_id, role, content, mode)
       VALUES ($1, $2, $3, $4)
       RETURNING id, conversation_id, role, content, mode, created_at`,
      [conversationId, role, content, mode]
    );
    return res.rows[0];
  },

  async listByConversation(conversationId) {
    const res = await query(
      `SELECT id, conversation_id, role, content, mode, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );
    return res.rows;
  },

  async getRecentHistory(conversationId, limit = 10) {
    const res = await query(
      `SELECT id, role, content, mode, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [conversationId, limit]
    );
    // Reverse to chronological order for LLM context
    return res.rows.reverse();
  },
};
