import type { NextFunction, Request, Response } from 'express';

import { toSerializable } from '../utils/serialization.js';

export const serializeResponse = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = ((body?: unknown) => originalJson(toSerializable(body))) as typeof res.json;

  next();
};
