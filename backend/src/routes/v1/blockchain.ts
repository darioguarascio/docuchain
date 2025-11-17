import { Request, Response } from 'express';
import limiter from '@utils/limiter.ts';
import { verifyBlockchain, getBlockchainHistory } from '@modules/blockchain/services/blockchain.service.ts';

export const get = [
  limiter,
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const history = await getBlockchainHistory(limit);
      return res.json({ history });
    } catch (error) {
      console.error('Error fetching blockchain history:', error);
      return res.status(500).json({ error: 'Failed to fetch blockchain history' });
    }
  },
];

export const verify = [
  limiter,
  async (req: Request, res: Response) => {
    try {
      const result = await verifyBlockchain();
      return res.json(result);
    } catch (error) {
      console.error('Error verifying blockchain:', error);
      return res.status(500).json({ error: 'Failed to verify blockchain' });
    }
  },
];

