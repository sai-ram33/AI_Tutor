import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.get('/me/stats', userController.getStats);

export default router;
