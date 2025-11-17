import { Request, Response } from 'express';
import { getHealthy } from '@utils/health-state.ts';

export const get = (req: Request, res: Response) => {
  const healthy = getHealthy();
  return res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'unhealthy' });
};

