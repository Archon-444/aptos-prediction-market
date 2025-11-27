import { NextFunction, Request, Response } from 'express';

import { prisma } from '../database/prismaClient.js';

export const requireRole = (role: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const address = req.wallet?.address;
    if (!address) {
      return res.status(401).json({ error: 'Wallet not authenticated' });
    }

    const user = await prisma.user.findUnique({ where: { walletAddress: address } });
    const roles = user?.roles ?? [];
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions', required: role, roles });
    }

    next();
  };
};
