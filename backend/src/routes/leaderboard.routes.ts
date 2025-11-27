import { Router } from 'express';

import { leaderboardController } from '../controllers/leaderboard.controller.js';
import { publicApiLimiter } from '../middleware/rateLimit.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', publicApiLimiter, leaderboardController.list);
leaderboardRouter.get('/user/:address', publicApiLimiter, leaderboardController.getUserSummary);
