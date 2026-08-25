import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_tutor',
  jwtSecret: process.env.JWT_SECRET || 'ai_tutor_super_secret_jwt_key_2026_change_in_production',
  aiApiKey: process.env.AI_API_KEY || '',
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-large-latest',
  qwenServiceUrl: process.env.QWEN_SERVICE_URL || 'http://127.0.0.1:8000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
};
