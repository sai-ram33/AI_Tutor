import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { UserModel } from '../models/userModel.js';
import { isPostgresAvailable } from '../config/db.js';

export const authMiddleware = async (req, res, next) => {
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
          const email = decoded.email || 'firebase-user@example.com';
          const name = decoded.name || decoded.displayName || 'Learner';
          let pgUserId = 1;

          if (isPostgresAvailable && decoded.email) {
            try {
              let dbUser = await UserModel.findByEmail(email);
              if (!dbUser) {
                dbUser = await UserModel.create({
                  name,
                  email,
                  passwordHash: null,
                  level: 'beginner',
                  language: 'english',
                });
              }
              if (dbUser && dbUser.id) {
                pgUserId = dbUser.id;
              }
            } catch (syncErr) {
              console.warn('[authMiddleware] DB user sync notice:', syncErr.message);
            }
          }

          userPayload = {
            userId: pgUserId,
            firebaseUid: decoded.user_id || decoded.sub,
            email,
            name,
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
