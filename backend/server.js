import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { initDb, query } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import visionRoutes from './routes/visionRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
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
app.get('/api/health', async (req, res) => {
  let databaseStatus = 'disconnected';
  try {
    const dbCheck = await query('SELECT 1');
    if (dbCheck && dbCheck.rowCount > 0) {
      databaseStatus = 'connected';
    }
  } catch (err) {
    databaseStatus = 'error';
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AI Teacher API',
    database: databaseStatus,
    version: '2.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/ai', aiRoutes);

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
