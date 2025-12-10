import express, { Request, Response } from 'express';
import { ttsService } from '../services/tts-service';

const router = express.Router();

/**
 * POST /api/tts/generate
 * Generate TTS audio and visemes from text
 */
router.post('/generate', async (req: Request, res: Response) => {
  const { text, voiceId, emotion, language } = req.body;

  if (!text || !voiceId) {
    return res.status(400).json({ error: 'text and voiceId are required' });
  }

  try {
    const result = await ttsService.generateTTS(
      text,
      voiceId,
      emotion,
      language || 'en'
    );

    res.json(result);
  } catch (error: any) {
    console.error('[TTSRoutes] Error generating TTS:', error);
    res.status(500).json({ error: error.message || 'Failed to generate TTS' });
  }
});

export { router as ttsRouter };

