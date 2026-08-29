import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export const authMiddleware = (req, res, next) => {
  // Fallback mock user for local testing without database
  req.user = {
    userId: 1,
    email: 'guest@example.com',
  };
  next();
};
