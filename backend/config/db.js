import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    // console.log('executed query', { text, duration, rows: res.rowCount });
  }
  return res;
};

export const initDb = async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash TEXT,
        google_id VARCHAR(100) UNIQUE,
        level VARCHAR(20) DEFAULT 'beginner',
        language VARCHAR(20) DEFAULT 'english',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) DEFAULT 'New Chat',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL,
        content TEXT NOT NULL,
        mode VARCHAR(20) DEFAULT 'explain',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    `);

    console.log('Database tables verified and initialized.');
    client.release();
  } catch (err) {
    console.error('PostgreSQL connection warning:', err.message);
    console.log('Ensure PostgreSQL is running and DATABASE_URL in backend/.env is valid.');
  }
};
