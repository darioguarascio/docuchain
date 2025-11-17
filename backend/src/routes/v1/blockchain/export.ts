import { Request, Response } from 'express';
import limiter from '@utils/limiter.ts';
import { getAnonymizedBlockchain } from '@modules/blockchain/services/blockchain.service.ts';

export const get = [
  limiter,
  async (req: Request, res: Response) => {
    try {
      const limitParam = parseInt(req.query.limit as string, 10);
      const safeLimit = Number.isNaN(limitParam) ? 1000 : Math.min(Math.max(limitParam, 1), 5000);
      const blocks = await getAnonymizedBlockchain(safeLimit);
      return res.json({ count: blocks.length, blocks });
    } catch (error) {
      console.error('Error exporting blockchain:', error);
      return res.status(500).json({ error: 'Failed to export blockchain' });
    }
  },
];

