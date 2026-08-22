import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { initDb } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AI Teacher API',
    version: '2.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', chatRoutes);

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  await initDb();

  app.listen(config.port, () => {
    console.log(`🚀 AI Teacher backend running on http://localhost:${config.port}`);
  });
};

startServer();
