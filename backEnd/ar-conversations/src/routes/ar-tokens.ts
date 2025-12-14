// src/routes/ar-tokens.ts
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

/**
 * GET /api/ar-rooms/:roomId/provider-tokens
 * Get signed tokens for TTS and animation providers
 */
router.get('/api/ar-rooms/:roomId/provider-tokens', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.jwtPayload!.id;

  // TODO: Validate room access - check if user owns the AR room

  // TODO: Get provider API keys from environment or secure storage
  const ttsProvider = process.env.TTS_PROVIDER || 'elevenlabs'; // or 'azure', 'web-speech'
  const animationProvider = process.env.ANIMATION_PROVIDER || 'client-side'; // client-side for phoneme-to-viseme

  // Generate signed tokens (simplified - should use proper JWT or HMAC signing)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

  // For TTS provider (ElevenLabs example)
  let ttsToken: any = null;
  if (ttsProvider === 'elevenlabs' && process.env.ELEVENLABS_API_KEY) {
    // In production, this should be a signed token, not the raw API key
    // For now, we'll return a token structure (should be encrypted/signed)
    ttsToken = {
      provider: 'elevenlabs',
      apiKey: process.env.ELEVENLABS_API_KEY, // TODO: Encrypt this
      expiresAt: expiresAt.toISOString(),
      allowedEndpoints: ['/v1/text-to-speech/*/stream'],
      signature: crypto.createHmac('sha256', process.env.JWT_DEV || 'secret')
        .update(`${roomId}-${userId}-${expiresAt.toISOString()}`)
        .digest('hex'),
    };
  } else if (ttsProvider === 'azure' && process.env.AZURE_SPEECH_KEY) {
    ttsToken = {
      provider: 'azure',
      apiKey: process.env.AZURE_SPEECH_KEY, // TODO: Encrypt this
      expiresAt: expiresAt.toISOString(),
      allowedEndpoints: ['/v1/speech/synthesize'],
      signature: crypto.createHmac('sha256', process.env.JWT_DEV || 'secret')
        .update(`${roomId}-${userId}-${expiresAt.toISOString()}`)
        .digest('hex'),
    };
  } else {
    // Web Speech API - no token needed (browser built-in)
    ttsToken = {
      provider: 'web-speech',
      apiKey: null,
      expiresAt: null,
      note: 'Browser built-in, no token required',
    };
  }

  // For animation provider - client-side phoneme-to-viseme doesn't need a token
  const animationToken = {
    provider: 'client-side',
    method: 'phoneme-to-viseme',
    note: 'Client-side processing, no token required',
  };

  res.status(200).send({
    ttsToken,
    animationToken,
    expiresAt: expiresAt.toISOString(),
  });
});

export { router as arTokensRouter };

