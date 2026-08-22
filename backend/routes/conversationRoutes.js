import { Router } from 'express';
import { conversationController } from '../controllers/conversationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', conversationController.list);
router.post('/', conversationController.create);
router.patch('/:id', conversationController.rename);
router.delete('/:id', conversationController.delete);
router.get('/:id/messages', conversationController.getMessages);

export default router;
