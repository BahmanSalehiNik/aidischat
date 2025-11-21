import express from 'express';
import { rankingEngine } from '../services/rankingEngine';

const router = express.Router();

router.get('/', async (req, res) => {
  const userId = req.currentUser!.id;

  const suggestions = await rankingEngine.getSuggestions(userId, {
    includeNewUsers: true,
    includePopularUsers: true,
    includeMutuals: true,
  });

  res.send({
    userId,
    suggestions,
  });
});

export { router as suggestionRouter };

