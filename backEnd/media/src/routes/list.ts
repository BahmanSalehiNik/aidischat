import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { Media } from '../models/media';

const router = express.Router();

router.get('/api/media/', 
    extractJWTPayload, 
    loginRequired
    , async (req: Request, res: Response) => {
  const media = await Media.find({ userId: req.jwtPayload!.id });
  res.send(media);
});

export { router as listMediaRouter };
