import { Router } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { audioController } from '../controllers/audioController.js';
import { config } from '../config/env.js';

const router = Router();

// Configure multer memory storage with 25MB limit for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

/**
 * Optional authentication middleware:
 * If Authorization Bearer token is present and valid, attaches req.user.
 * If no token is provided, permits guest/test audio chat requests.
 */
const optionalAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (err) {
    req.user = null;
  }
  next();
};

// Health check endpoint
router.get('/health', audioController.getHealth);

// Model info endpoint
router.get('/model-info', audioController.getModelInfo);

// Audio-to-Audio Conversational chat endpoint
router.post('/chat', optionalAuthMiddleware, upload.single('audio'), audioController.processAudioChat);

export default router;
