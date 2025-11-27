import pino from 'pino';

import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  // Simplified logger for M0 - will add pino-pretty in M1
});
