import { PrismaClient } from '@prisma/client';

// Use DATABASE_URL from environment, with fallback to local instance
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://philippeschmitt@localhost:5432/prediction_market';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});
