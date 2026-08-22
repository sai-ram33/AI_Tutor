import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please provide a valid bearer token.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired authentication token. Please log in again.',
    });
  }
};
