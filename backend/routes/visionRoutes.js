import { Router } from 'express';
import multer from 'multer';
import { visionController } from '../controllers/visionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Configure multer memory storage with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Health check endpoint (can be checked without auth)
router.get('/health', visionController.getHealth);

// Vision chat endpoint protected by authMiddleware
router.post('/chat', authMiddleware, upload.single('image'), visionController.processVisionChat);

export default router;
