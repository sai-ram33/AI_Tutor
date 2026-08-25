import { Router } from 'express';
import { chatController } from '../controllers/chatController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/', chatController.sendMessage);
router.get('/:conversationId/recap', chatController.getRecap);

export default router;
