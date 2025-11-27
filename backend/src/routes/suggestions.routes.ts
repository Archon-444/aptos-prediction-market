import { Router } from 'express';

import { suggestionController } from '../controllers/suggestions.controller.js';
import { authenticateWallet } from '../middleware/authenticateWallet.js';
import {
  adminApiLimiter,
  authenticatedApiLimiter,
  blockchainWriteLimiter,
  publicApiLimiter,
} from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/requireRole.js';

export const suggestionsRouter = Router();

/**
 * @swagger
 * /api/suggestions:
 *   post:
 *     summary: Create a new market suggestion
 *     description: Submit a proposal for a new prediction market. Requires wallet authentication.
 *     tags: [Suggestions]
 *     security:
 *       - DevWalletAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *               - outcomes
 *               - durationHours
 *             properties:
 *               question:
 *                 type: string
 *                 description: Market question
 *                 example: "Will BTC reach $100k by EOY 2025?"
 *               outcomes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 2
 *                 description: Possible outcomes (min 2)
 *                 example: ["Yes", "No"]
 *               category:
 *                 type: string
 *                 description: Market category
 *                 example: "crypto"
 *               durationHours:
 *                 type: number
 *                 description: Market duration in hours
 *                 example: 168
 *               resolutionSource:
 *                 type: string
 *                 description: Oracle or data source for resolution
 *                 example: "CoinMarketCap"
 *               chain:
 *                 type: string
 *                 enum: [aptos, sui, movement]
 *                 default: aptos
 *                 description: Target blockchain
 *     responses:
 *       201:
 *         description: Suggestion created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Suggestion'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized (missing wallet authentication)
 *       429:
 *         description: Rate limit exceeded (120 req/min)
 */
// Create suggestion - authenticated users, standard rate limit
suggestionsRouter.post(
  '/',
  authenticatedApiLimiter,
  authenticateWallet,
  suggestionController.createSuggestion
);

/**
 * @swagger
 * /api/suggestions:
 *   get:
 *     summary: List market suggestions
 *     description: Retrieve all market suggestions with optional filtering
 *     tags: [Suggestions]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Filter by status
 *       - in: query
 *         name: chain
 *         schema:
 *           type: string
 *           enum: [aptos, sui, movement]
 *         description: Filter by blockchain
 *     responses:
 *       200:
 *         description: List of suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Suggestion'
 *       429:
 *         description: Rate limit exceeded (60 req/min)
 */
// List suggestions - public endpoint, lower rate limit
suggestionsRouter.get('/', publicApiLimiter, suggestionController.listSuggestions);

// Approve suggestion - admin only, higher rate limit
suggestionsRouter.patch(
  '/:id/approve',
  blockchainWriteLimiter,
  adminApiLimiter,
  authenticateWallet,
  requireRole('ROLE_ADMIN'),
  suggestionController.approveSuggestion
);

// Reject suggestion - admin only, higher rate limit
suggestionsRouter.patch(
  '/:id/reject',
  adminApiLimiter,
  authenticateWallet,
  requireRole('ROLE_ADMIN'),
  suggestionController.rejectSuggestion
);

// Vote on suggestion - authenticated users, standard rate limit
suggestionsRouter.patch(
  '/:id/vote',
  authenticatedApiLimiter,
  authenticateWallet,
  suggestionController.upvoteSuggestion
);

// List events - authenticated users, standard rate limit
suggestionsRouter.get(
  '/:id/events',
  authenticatedApiLimiter,
  authenticateWallet,
  suggestionController.listEvents
);

/**
 * @swagger
 * /api/suggestions/{id}/publish:
 *   post:
 *     summary: Publish approved suggestion to blockchain
 *     description: Create the market on-chain for an approved suggestion. Requires admin role.
 *     tags: [Suggestions]
 *     security:
 *       - DevWalletAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Suggestion ID
 *     responses:
 *       200:
 *         description: Market published successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Suggestion'
 *       400:
 *         description: Suggestion not approved or already published
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Suggestion not found
 *       429:
 *         description: Rate limit exceeded
 */
// Publish suggestion - admin only, blockchain write rate limit
suggestionsRouter.post(
  '/:id/publish',
  blockchainWriteLimiter,
  adminApiLimiter,
  authenticateWallet,
  requireRole('ROLE_ADMIN'),
  suggestionController.publishSuggestion
);
