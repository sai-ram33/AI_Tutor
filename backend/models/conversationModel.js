import { query } from '../config/db.js';

export const ConversationModel = {
  async create({ userId, title = 'New Chat' }) {
    const res = await query(
      `INSERT INTO conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id, user_id, title, created_at`,
      [userId, title]
    );
    return res.rows[0];
  },

  async listByUser(userId) {
    const res = await query(
      `SELECT c.id, c.user_id, c.title, c.created_at,
              COALESCE(MAX(m.created_at), c.created_at) AS updated_at,
              COUNT(m.id)::int AS message_count
       FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY updated_at DESC`,
      [userId]
    );
    return res.rows;
  },

  async findById(id) {
    const res = await query(
      `SELECT id, user_id, title, created_at FROM conversations WHERE id = $1`,
      [id]
    );
    return res.rows[0];
  },

  async updateTitle(id, userId, title) {
    const res = await query(
      `UPDATE conversations
       SET title = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, title, created_at`,
      [title, id, userId]
    );
    return res.rows[0];
  },

  async delete(id, userId) {
    const res = await query(
      `DELETE FROM conversations
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );
    return res.rows[0] ? true : false;
  },
};
