import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { UserModel } from '../models/userModel.js';
import { config } from '../config/env.js';

const googleClient = new OAuth2Client(config.googleClientId);

export const authController = {
  async signup(req, res, next) {
    try {
      const { name, email, password, level, language } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      }

      const existing = await UserModel.findByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'An account with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await UserModel.create({
        name,
        email,
        passwordHash,
        level: level || 'beginner',
        language: language || 'english',
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'Account created successfully.',
        token,
        user,
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      const { password_hash, ...safeUser } = user;

      res.json({
        message: 'Logged in successfully.',
        token,
        user: safeUser,
      });
    } catch (err) {
      next(err);
    }
  },

  async googleLogin(req, res, next) {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({ error: 'Google ID token is required.' });
      }

      if (!config.googleClientId) {
        return res.status(500).json({ error: 'Google Sign-In is not configured on this server.' });
      }

      // Step 1: Verify the token is genuinely from Google for our app
      let payload;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: config.googleClientId,
        });
        payload = ticket.getPayload();
      } catch {
        // Token invalid, expired, or forged — reject immediately
        return res.status(401).json({ error: 'Google sign-in failed. Token is invalid or expired.' });
      }

      const { sub: googleId, email, name } = payload;

      // Step 2: Look up user by their Google ID (fastest path — returning user)
      let user = await UserModel.findByGoogleId(googleId);

      if (!user) {
        // Step 3: Check if an email/password account already exists with this email
        const existingByEmail = await UserModel.findByEmail(email);

        if (existingByEmail) {
          // Link Google to existing email/password account — no duplicate user created
          user = await UserModel.linkGoogleId(existingByEmail.id, googleId);
        } else {
          // Step 4: Brand new user — create with google_id, password_hash stays NULL
          user = await UserModel.createFromGoogle({ name, email, googleId });
        }
      }

      // Step 5: Issue our own JWT (identical format to regular login)
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Google sign-in successful.',
        token,
        user,
      });
    } catch (err) {
      next(err);
    }
  },
};
