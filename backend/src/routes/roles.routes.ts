import { Router } from 'express';

import { rolesController } from '../controllers/roles.controller.js';
import { authenticateWallet } from '../middleware/authenticateWallet.js';
import { adminApiLimiter, strictApiLimiter } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/requireRole.js';

export const rolesRouter = Router();

// Get user roles - authenticated, admin rate limit
rolesRouter.get('/:address', adminApiLimiter, authenticateWallet, rolesController.getUserRoles);

// Sync on-chain roles to backend
rolesRouter.post('/sync', adminApiLimiter, authenticateWallet, rolesController.syncRoles);

// Grant role - admin only, strict rate limit (sensitive operation)
rolesRouter.post(
  '/grant',
  strictApiLimiter,
  authenticateWallet,
  requireRole('ROLE_ADMIN'),
  rolesController.grantRole
);

// Revoke role - admin only, strict rate limit (sensitive operation)
rolesRouter.post(
  '/revoke',
  strictApiLimiter,
  authenticateWallet,
  requireRole('ROLE_ADMIN'),
  rolesController.revokeRole
);
