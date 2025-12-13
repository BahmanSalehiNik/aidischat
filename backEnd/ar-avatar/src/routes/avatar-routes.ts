import express, { Request, Response } from 'express';
import { avatarService } from '../services/avatar-service';

const router = express.Router();

/**
 * GET /api/avatars/:agentId
 * Get avatar for an agent
 */
router.get('/:agentId', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  
  const avatar = await avatarService.getAvatar(agentId);
  
  if (!avatar) {
    return res.status(404).json({ error: 'Avatar not found' });
  }
  
  res.json(avatar);
});

/**
 * POST /api/avatars/generate
 * Generate avatar for an agent
 */
router.post('/generate', async (req: Request, res: Response) => {
  const { agentId, agentProfile } = req.body;
  
  if (!agentId || !agentProfile) {
    return res.status(400).json({ error: 'agentId and agentProfile are required' });
  }
  
  try {
    // Start generation (async)
    avatarService.generateAvatar(agentId, agentProfile).catch(err => {
      console.error(`[AvatarRoutes] Error generating avatar for ${agentId}:`, err);
    });
    
    // Return immediately with status
    res.json({
      agentId,
      status: 'generating',
      message: 'Avatar generation started',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start avatar generation' });
  }
});

/**
 * GET /api/avatars/:agentId/status
 * Get avatar generation status with progress
 */
router.get('/:agentId/status', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  
  const status = await avatarService.getAvatarStatus(agentId);
  res.json(status);
});

/**
 * GET /api/avatars/:agentId/download-url
 * Get signed download URL for avatar model (for private containers)
 * Optional query param: expiresSeconds (default: 900 = 15 minutes)
 */
router.get('/:agentId/download-url', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const expiresSeconds = parseInt(req.query.expiresSeconds as string) || 900;
  
  const avatar = await avatarService.getAvatar(agentId);
  
  if (!avatar) {
    return res.status(404).json({ error: 'Avatar not found' });
  }
  
  if (!avatar.modelUrl) {
    return res.status(404).json({ error: 'Avatar model not available' });
  }
  
  if (avatar.status !== 'ready') {
    return res.status(400).json({ 
      error: 'Avatar not ready', 
      status: avatar.status 
    });
  }
  
  // Generate signed URL if needed (for private containers)
  // If modelUrl is already public, return it directly
  try {
    const { storageService } = await import('../services/storage-service');
    
    // Check if URL is from our storage (needs signing) or external (already public)
    const isStorageUrl = avatar.modelUrl.includes('.blob.core.windows.net') || 
                        avatar.modelUrl.includes('.s3.') ||
                        avatar.modelUrl.includes('storage.googleapis.com');
    
    if (isStorageUrl && avatar.modelUrl) {
      // Parse the blob URL to extract container and blob name properly
      // Remove query string first to get clean URL (SAS token)
      const cleanUrl = avatar.modelUrl.split('?')[0];
      
      // Parse URL to extract container and blob path
      try {
        const url = new URL(cleanUrl);
        const pathParts = url.pathname.split('/').filter(Boolean);
        
        if (pathParts.length < 2) {
          // Invalid URL structure, return stored URL as fallback
          return res.json({ 
            url: avatar.modelUrl,
            expiresIn: null,
            format: avatar.format,
            modelType: avatar.modelType,
          });
        }
        
        const containerName = pathParts[0];
        const blobName = pathParts.slice(1).join('/');
        
        // Generate a fresh signed URL with the requested expiration
        const signedUrl = await storageService.generateSignedUrlForBlob(
          containerName,
          blobName,
          expiresSeconds
        );
        
        return res.json({ 
          url: signedUrl,
          expiresIn: expiresSeconds,
          format: avatar.format,
          modelType: avatar.modelType,
        });
      } catch (error) {
        console.error(`[AvatarRoutes] Error parsing blob URL:`, error);
        // Fallback: return the stored URL (might already be signed)
        return res.json({ 
          url: avatar.modelUrl,
          expiresIn: null,
          format: avatar.format,
          modelType: avatar.modelType,
        });
      }
    }
    
    // External URL (Meshy, etc.) - return as-is
    return res.json({ 
      url: avatar.modelUrl,
      expiresIn: null, // External URLs don't expire
      format: avatar.format,
      modelType: avatar.modelType,
    });
  } catch (error: any) {
    console.error(`[AvatarRoutes] Error generating download URL:`, error);
    // Fallback to returning the modelUrl directly
    return res.json({ 
      url: avatar.modelUrl,
      expiresIn: null,
      format: avatar.format,
      modelType: avatar.modelType,
    });
  }
});

/**
 * POST /api/avatars/sign-url
 * Sign a blob URL for media service (creates SAS URL with limited lifetime)
 * This endpoint allows other services to request signed URLs for private containers
 */
router.post('/sign-url', async (req: Request, res: Response) => {
  const { containerName, blobName, expiresSeconds } = req.body;
  
  if (!containerName || !blobName) {
    return res.status(400).json({ error: 'containerName and blobName are required' });
  }

  const expiresIn = expiresSeconds || 900; // Default 15 minutes

  try {
    const { storageService } = await import('../services/storage-service');
    const signedUrl = await storageService.generateSignedUrlForBlob(
      containerName,
      blobName,
      expiresIn
    );
    
    return res.json({
      url: signedUrl,
      expiresIn,
      container: containerName,
      blob: blobName,
    });
  } catch (error: any) {
    console.error(`[AvatarRoutes] Error signing URL for ${containerName}/${blobName}:`, error);
    res.status(500).json({ error: error.message || 'Failed to sign URL' });
  }
});

export { router as avatarRouter };

