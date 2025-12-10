import { Avatar, AvatarDoc, AvatarAttrs, AvatarStatus, AvatarModelType } from '../models/avatar';
import { characterDescriptionGenerator, CharacterDescription } from './character-description-generator';
import { modelGenerator, GeneratedModel } from './model-generator';
import { storageService } from './storage-service';

export class AvatarService {
  /**
   * Generate avatar for an agent
   */
  async generateAvatar(agentId: string, agentProfile: any): Promise<AvatarDoc> {
    console.log(`[AvatarService] Generating avatar for agent ${agentId}`);

    // Check if avatar already exists
    const existing = await Avatar.findByAgentId(agentId);
    if (existing && existing.status === AvatarStatus.Ready) {
      console.log(`[AvatarService] Avatar already exists for agent ${agentId}`);
      return existing;
    }

    // Create or update avatar record
    const avatar = existing || Avatar.build({
      agentId,
      ownerUserId: agentProfile.ownerUserId || agentProfile.ownerId,
      status: AvatarStatus.Pending,
    });

    avatar.status = AvatarStatus.Generating;
    avatar.generationStartedAt = new Date();
    await avatar.save();

    try {
      // Step 1: Generate character description
      const description = await characterDescriptionGenerator.generateDescription(agentProfile);
      avatar.characterDescription = description as any;

      // Step 2: Generate model
      const generatedModel = await modelGenerator.generateModel(agentProfile);

      // Step 3: Download and store model
      const uploadResult = await storageService.downloadAndStore(
        generatedModel.modelUrl,
        `${agentId}_${Date.now()}.${generatedModel.format}`
      );

      // Step 4: Update avatar record
      avatar.modelUrl = storageService.generateCDNUrl(uploadResult.key);
      avatar.format = generatedModel.format;
      avatar.modelType = this.determineModelType(description);
      avatar.provider = generatedModel.modelId.split('_')[0]; // Extract provider from modelId
      avatar.providerModelId = generatedModel.modelId;
      avatar.polygonCount = generatedModel.metadata.polygonCount;
      avatar.textureResolution = generatedModel.metadata.textureResolution;
      avatar.boneCount = generatedModel.metadata.boneCount;
      avatar.animationCount = generatedModel.metadata.animationCount;
      avatar.status = AvatarStatus.Ready;
      avatar.generationCompletedAt = new Date();
      avatar.lipSync = {
        enabled: true,
        method: 'viseme',
      };
      avatar.animations = {
        idle: 'idle',
        talking: 'talking',
        gestures: ['wave', 'nod', 'point'],
      };

      await avatar.save();

      console.log(`[AvatarService] Avatar generated successfully for agent ${agentId}`);
      return avatar;
    } catch (error: any) {
      console.error(`[AvatarService] Error generating avatar for agent ${agentId}:`, error);
      
      avatar.status = AvatarStatus.Failed;
      avatar.generationError = error.message || 'Unknown error';
      await avatar.save();

      throw error;
    }
  }

  /**
   * Get avatar for an agent
   */
  async getAvatar(agentId: string): Promise<AvatarDoc | null> {
    return Avatar.findByAgentId(agentId);
  }

  /**
   * Get avatar generation status
   */
  async getAvatarStatus(agentId: string): Promise<{
    status: AvatarStatus;
    progress?: number;
    error?: string;
  }> {
    const avatar = await Avatar.findByAgentId(agentId);
    if (!avatar) {
      return { status: AvatarStatus.Pending };
    }

    return {
      status: avatar.status,
      error: avatar.generationError,
      progress: this.calculateProgress(avatar),
    };
  }

  private determineModelType(description: CharacterDescription): AvatarModelType {
    if (description.style === 'anime' || description.style === 'chibi') {
      return AvatarModelType.Anime;
    }
    return AvatarModelType.ThreeD;
  }

  private calculateProgress(avatar: any): number {
    if (avatar.status === AvatarStatus.Ready) return 100;
    if (avatar.status === AvatarStatus.Failed) return 0;
    if (avatar.status === AvatarStatus.Generating) {
      // Estimate progress based on time elapsed
      if (avatar.generationStartedAt) {
        const elapsed = Date.now() - avatar.generationStartedAt.getTime();
        const estimatedTotal = 30000; // 30 seconds
        return Math.min(90, Math.floor((elapsed / estimatedTotal) * 100));
      }
      return 50; // Default progress
    }
    return 0;
  }
}

export const avatarService = new AvatarService();

