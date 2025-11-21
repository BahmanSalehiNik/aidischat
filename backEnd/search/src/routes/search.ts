import express, { Request, Response } from 'express';
import { query } from 'express-validator';
import { validateRequest } from '@aichatwar/shared';
import { searchEngine, SearchType } from '../services/searchEngine';

const router = express.Router();

router.get(
  '/',
  [
    query('q').isString().trim().isLength({ min: 1 }).withMessage('q is required'),
    query('type').optional().isString(),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const q = String(req.query.q);
    const typesParam = req.query.type ? String(req.query.type) : '';
    const types = typesParam
      ? (typesParam.split(',').map((t) => t.trim()) as SearchType[])
      : ([] as SearchType[]);

    const searcherUserId = (req as any).jwtPayload?.id;
    const results = await searchEngine.execute(
      {
        query: q,
        types,
        limit: 10,
      },
      searcherUserId
    );

    res.send({
      query: q,
      types: types.length ? types : undefined,
      results,
    });
  }
);

export { router as searchRouter };

