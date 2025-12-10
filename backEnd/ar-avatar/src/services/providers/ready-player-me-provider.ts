import axios from 'axios';
import { BaseModelProvider } from './base-provider';
import { CharacterDescription } from '../character-description-generator';
import { GeneratedModel } from '../model-generator';
import { AvatarModelFormat } from '../../models/avatar';

/**
 * Ready Player Me provider implementation
 * Documentation: https://docs.readyplayer.me/
 */
export class ReadyPlayerMeProvider extends BaseModelProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.readyplayer.me');
  }

  getName(): string {
    return 'ready-player-me';
  }

  async generateModel(description: CharacterDescription): Promise<GeneratedModel> {
    console.log('[ReadyPlayerMeProvider] Starting model generation...');
    
    if (!this.isAvailable()) {
      throw new Error('Ready Player Me API key is not configured');
    }

    try {
      // Build avatar configuration from character description
      const avatarConfig = this.buildAvatarConfig(description);
      
      // Step 1: Create avatar using Ready Player Me API
      const avatarId = await this.createAvatar(avatarConfig);
      console.log(`[ReadyPlayerMeProvider] Avatar created: ${avatarId}`);

      // Step 2: Get avatar model URL
      const modelUrl = await this.getModelUrl(avatarId);
      console.log(`[ReadyPlayerMeProvider] Model URL retrieved: ${modelUrl}`);

      return {
        modelId: `rpm_${avatarId}`,
        modelUrl,
        format: AvatarModelFormat.GLB,
        metadata: {
          polygonCount: 10000,
          textureResolution: 2048,
          boneCount: 75,
          animationCount: 10,
        },
      };
    } catch (error: any) {
      console.error('[ReadyPlayerMeProvider] Generation error:', error);
      throw new Error(`Ready Player Me generation failed: ${error.message}`);
    }
  }

  private buildAvatarConfig(description: CharacterDescription): any {
    // Ready Player Me uses a specific configuration format
    // Based on their API documentation
    const config: any = {
      // Gender
      gender: description.gender === 'neutral' ? 'neutral' : description.gender,
      
      // Body type
      bodyType: description.bodyType || 'fullbody',
      
      // Face shape
      faceShape: this.mapToFaceShape(description),
      
      // Hair
      hair: description.hair ? {
        style: this.mapToHairStyle(description.hair.style),
        color: this.mapToColor(description.hair.color),
      } : undefined,
      
      // Eyes
      eyes: description.eyes ? {
        color: this.mapToColor(description.eyes.color),
      } : undefined,
      
      // Skin tone
      skinTone: this.mapToSkinTone(description),
      
      // Outfit (clothing)
      outfit: description.clothing ? {
        top: description.clothing,
      } : undefined,
    };

    return config;
  }

  private mapToFaceShape(description: CharacterDescription): string {
    // Map expression baseline to face shape
    if (description.expressionBaseline === 'cute') return 'round';
    if (description.expressionBaseline === 'dramatic') return 'angular';
    return 'oval'; // default
  }

  private mapToHairStyle(style: string): string {
    // Map common hair styles to Ready Player Me options
    const styleMap: Record<string, string> = {
      'long': 'long',
      'short': 'short',
      'medium': 'medium',
      'curly': 'curly',
      'straight': 'straight',
      'wavy': 'wavy',
    };
    return styleMap[style.toLowerCase()] || 'medium';
  }

  private mapToColor(color: string): string {
    // Map color names to hex codes or Ready Player Me color IDs
    const colorMap: Record<string, string> = {
      'black': '#000000',
      'brown': '#8B4513',
      'blonde': '#FFD700',
      'red': '#FF0000',
      'silver': '#C0C0C0',
      'white': '#FFFFFF',
      'blue': '#0000FF',
      'green': '#008000',
      'dark brown': '#A52A2A',
    };
    return colorMap[color.toLowerCase()] || color;
  }

  private mapToSkinTone(description: CharacterDescription): string {
    // Default skin tone mapping
    return '#FFDBB3'; // Light skin tone as default
  }

  private async createAvatar(config: any): Promise<string> {
    // Ready Player Me API endpoint for creating avatars
    // Documentation: https://docs.readyplayer.me/ready-player-me/api-reference/avatars
    const response = await axios.post(
      `${this.baseUrl}/v1/avatars`,
      config,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (!response.data || !response.data.id) {
      throw new Error('Invalid response from Ready Player Me API');
    }

    return response.data.id;
  }

  private async getModelUrl(avatarId: string): Promise<string> {
    // Get the GLB model URL for the avatar
    // Ready Player Me provides different formats: glb, gltf, etc.
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/avatars/${avatarId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 10000,
        }
      );

      // If direct URL is available in response
      if (response.data && response.data.url) {
        return response.data.url;
      }

      // Check for GLB URL
      if (response.data && response.data.glbUrl) {
        return response.data.glbUrl;
      }
    } catch (error: any) {
      console.warn('[ReadyPlayerMeProvider] Could not fetch avatar details, using fallback URL');
    }

    // Fallback: construct URL from avatar ID
    // Ready Player Me typically serves models at: https://models.readyplayer.me/{avatarId}.glb
    return `https://models.readyplayer.me/${avatarId}.glb`;
  }
}

