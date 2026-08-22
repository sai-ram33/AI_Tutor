import { UserModel } from '../models/userModel.js';

export const userController = {
  async getMe(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },

  async updateMe(req, res, next) {
    try {
      const { name, level, language } = req.body;
      const updatedUser = await UserModel.update(req.user.userId, { name, level, language });
      res.json({
        message: 'Profile updated successfully.',
        user: updatedUser,
      });
    } catch (err) {
      next(err);
    }
  },

  async getStats(req, res, next) {
    try {
      const stats = await UserModel.getStats(req.user.userId);
      res.json({ stats });
    } catch (err) {
      next(err);
    }
  },
};
