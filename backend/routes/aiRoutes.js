import { Router } from 'express';
import { aiController } from '../controllers/aiController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Public endpoint to query supported TTS voices and model
router.get('/voices', aiController.getVoices);

// Protected endpoint to generate speech audio from text
router.post('/text-to-audio', authMiddleware, aiController.generateTextToAudio);

export default router;
