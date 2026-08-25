import { query } from '../config/db.js';

export const UserModel = {
  async create({ name, email, passwordHash, level = 'beginner', language = 'english' }) {
    const res = await query(
      `INSERT INTO users (name, email, password_hash, level, language)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, level, language, created_at`,
      [name, email.toLowerCase(), passwordHash, level, language]
    );
    return res.rows[0];
  },

  async createFromGoogle({ name, email, googleId, level = 'beginner', language = 'english' }) {
    const res = await query(
      `INSERT INTO users (name, email, google_id, level, language)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, level, language, created_at`,
      [name, email.toLowerCase(), googleId, level, language]
    );
    return res.rows[0];
  },

  async findByEmail(email) {
    const res = await query(
      `SELECT * FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    return res.rows[0];
  },

  async findByGoogleId(googleId) {
    const res = await query(
      `SELECT id, name, email, level, language, created_at FROM users WHERE google_id = $1`,
      [googleId]
    );
    return res.rows[0];
  },

  async linkGoogleId(userId, googleId) {
    const res = await query(
      `UPDATE users SET google_id = $1 WHERE id = $2
       RETURNING id, name, email, level, language, created_at`,
      [googleId, userId]
    );
    return res.rows[0];
  },

  async findById(id) {
    const res = await query(
      `SELECT id, name, email, level, language, created_at FROM users WHERE id = $1`,
      [id]
    );
    return res.rows[0];
  },

  async update(id, { name, level, language }) {
    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(name);
    }
    if (level !== undefined) {
      updates.push(`level = $${idx++}`);
      values.push(level);
    }
    if (language !== undefined) {
      updates.push(`language = $${idx++}`);
      values.push(language);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const res = await query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, name, email, level, language, created_at`,
      values
    );
    return res.rows[0];
  },

  async delete(id) {
    await query(`DELETE FROM users WHERE id = $1`, [id]);
    return true;
  },

  async getStats(userId) {
    // 1. Total questions asked
    const qRes = await query(
      `SELECT COUNT(*)::int AS questions_asked
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = $1 AND m.role = 'user'`,
      [userId]
    );
    const questionsAsked = qRes.rows[0]?.questions_asked || 0;

    // 2. Subjects explored (approximated by count of distinct non-empty titles)
    const sRes = await query(
      `SELECT COUNT(DISTINCT title)::int AS subjects_explored
       FROM conversations
       WHERE user_id = $1 AND title IS NOT NULL AND title != 'New Chat'`,
      [userId]
    );
    const subjectsExplored = sRes.rows[0]?.subjects_explored || (questionsAsked > 0 ? 1 : 0);

    // 3. Consecutive study streak
    const dateRes = await query(
      `SELECT DISTINCT DATE(m.created_at) AS study_date
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = $1 AND m.role = 'user'
       ORDER BY study_date DESC`,
      [userId]
    );

    const dates = dateRes.rows.map((r) => r.study_date);
    const streakDays = calculateStreak(dates);

    return {
      questionsAsked,
      subjectsExplored,
      streakDays,
    };
  },
};

function calculateStreak(dates) {
  if (!dates || dates.length === 0) return 0;

  const toLocalDateStr = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStrings = new Set(dates.map((d) => toLocalDateStr(d)));

  const todayStr = toLocalDateStr(today);
  const yesterdayStr = toLocalDateStr(yesterday);

  // If neither today nor yesterday has a message, streak is broken
  if (!dateStrings.has(todayStr) && !dateStrings.has(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  const checkDate = dateStrings.has(todayStr) ? new Date(today) : new Date(yesterday);

  while (true) {
    const checkStr = toLocalDateStr(checkDate);
    if (dateStrings.has(checkStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
