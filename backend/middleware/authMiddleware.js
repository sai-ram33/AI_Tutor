import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  let userPayload = {
    userId: 1,
    email: 'guest@example.com',
  };

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      // First try standard JWT verify
      const verified = jwt.verify(token, config.jwtSecret);
      userPayload = {
        userId: verified.userId || verified.id || 1,
        email: verified.email || 'user@example.com',
      };
    } catch (e) {
      // If verification with backend secret fails, it could be a Firebase ID token
      try {
        const decoded = jwt.decode(token);
        if (decoded && (decoded.user_id || decoded.sub)) {
          userPayload = {
            userId: decoded.user_id || decoded.sub,
            email: decoded.email || 'firebase-user@example.com',
            name: decoded.name || 'Firebase User',
          };
        }
      } catch (decodeErr) {
        // Fallback to default
      }
    }
  }

  req.user = userPayload;
  next();
};
