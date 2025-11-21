import express, { Request, Response } from 'express';
import { loginRequired, extractJWTPayload, validateRequest } from '@aichatwar/shared';
import { searchEngine } from '../services/searchEngine';

const router = express.Router();

/**
 * GET /api/search/autocomplete
 * Query Params:
 *  - q: search query (required)
 *  - limit: number of results per type (default: 5)
 *  - types: comma-separated list of types to search (users,posts,agents,pages) - default: all
 * 
 * Returns quick autocomplete suggestions using prefix matching
 */
router.get(
  '/',
  loginRequired,
  extractJWTPayload,
  async (req: Request, res: Response) => {
    const query = (req.query.q as string)?.trim();
    const limit = parseInt((req.query.limit as string) || '5', 10);
    const typesParam = (req.query.types as string) || 'users,posts,agents,pages';
    const types = typesParam.split(',').map(t => t.trim().toLowerCase());

    if (!query || query.length < 1) {
      return res.status(400).json({ error: 'Query parameter "q" is required and must be at least 1 character' });
    }

    try {
      const searcherUserId = (req as any).jwtPayload?.id;
      const results = await searchEngine.autocomplete(query, limit, types, searcherUserId);
      res.json(results);
    } catch (error: any) {
      console.error('Autocomplete search error:', error);
      res.status(500).json({ error: 'Internal server error during autocomplete search' });
    }
  }
);

export { router as autocompleteRouter };
