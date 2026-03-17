import { Router } from 'express';

import { leaderboardRouter } from './leaderboard.routes.js';
import { marketsRouter } from './markets.routes.js';
import { portfolioRouter } from './portfolio.routes.js';
import resolverRouter from './resolver.js';
import { rolesRouter } from './roles.routes.js';
import { suggestionsRouter } from './suggestions.routes.js';
import { tradesRouter } from './trades.routes.js';

export const router = Router();

router.use('/suggestions', suggestionsRouter);
router.use('/roles', rolesRouter);
router.use('/markets', marketsRouter);
router.use('/leaderboard', leaderboardRouter);
router.use('/resolver', resolverRouter);
router.use('/trades', tradesRouter);
router.use('/portfolio', portfolioRouter);
