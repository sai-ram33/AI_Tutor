import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';

const router = Router();

// Public health check endpoint for cron jobs, keep-alive pings, and uptime monitoring
router.get('/', healthController.checkHealth);
router.head('/', healthController.checkHealth);

export default router;
