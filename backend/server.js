import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { initDb } from './config/db.js';
import healthRoutes from './routes/healthRoutes.js';
import { healthController } from './controllers/healthController.js';
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
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));

// Healthcheck & Keep-alive for cron jobs and uptime monitoring
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);
app.use('/ping', healthRoutes);
app.use('/api/cron/health', healthRoutes);
app.use('/api/cron/keepalive', healthRoutes);
app.get('/', healthController.checkHealth);
app.head('/', healthController.checkHealth);

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
