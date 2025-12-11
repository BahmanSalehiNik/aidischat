import axios from 'axios';
import { BaseModelProvider } from './base-provider';
import { CharacterDescription } from '../character-description-generator';
import { GeneratedModel } from '../model-generator';
import { AvatarModelFormat } from '../../models/avatar';
import { AVATAR_CONFIG } from '../../config/constants';

/**
 * Ready Player Me provider implementation
 * Documentation: https://docs.readyplayer.me/ready-player-me/api-reference/rest-api
 * Authentication: Uses X-API-Key and X-App-Key headers
 */
export class ReadyPlayerMeProvider extends BaseModelProvider {
  private appId: string;

  constructor(apiKey: string, appId?: string) {
    super(apiKey, 'https://api.readyplayer.me');
    this.appId = appId || AVATAR_CONFIG.READY_PLAYER_ME_APP_ID;
    if (!this.appId) {
      console.warn('[ReadyPlayerMeProvider] App ID not configured - some API calls may fail');
    }
  }

  getName(): string {
    return 'ready-player-me';
  }

  async generateModel(description: CharacterDescription, agentId?: string): Promise<GeneratedModel> {
    console.log('[ReadyPlayerMeProvider] Starting model generation...');
    
    if (!this.isAvailable()) {
      throw new Error('Ready Player Me API key is not configured');
    }

    try {
      // Build avatar configuration from character description
      const avatarConfig = this.buildAvatarConfig(description);
      
      // Create avatar using Ready Player Me API
      const avatarId = await this.createAvatar(avatarConfig, agentId);
      console.log(`[ReadyPlayerMeProvider] Avatar created: ${avatarId}`);

      // Get avatar model URL
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
    // Note: applicationId is now sent in X-App-Key header, not in body
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

  private async createAvatar(config: any, agentId?: string): Promise<string> {
    // Ready Player Me API endpoint for creating avatars
    // Documentation: https://docs.readyplayer.me/ready-player-me/api-reference/avatars
    // Authentication: Uses x-api-key and x-app-key headers (lowercase)
    try {
      const headers: any = {
        'x-api-key': this.apiKey,  // lowercase header
        'Content-Type': 'application/json',
      };
      
      // Add App Key header if available
      if (this.appId) {
        headers['x-app-key'] = this.appId;  // lowercase header
        console.log('[ReadyPlayerMeProvider] Using App ID:', this.appId.substring(0, 8) + '...');
      } else {
        console.warn('[ReadyPlayerMeProvider] App ID not set - request may fail');
      }

      // Log headers (without sensitive data)
      console.log('[ReadyPlayerMeProvider] Request headers:', {
        'x-api-key': headers['x-api-key'] ? '***' : 'not set',
        'x-app-key': headers['x-app-key'] ? headers['x-app-key'].substring(0, 8) + '...' : 'not set',
        'Content-Type': headers['Content-Type'],
      });

      // Generate userId from agentId or use a default
      // Ready Player Me requires userId to be a valid object-id format string
      const userId = agentId || `agent_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Use appId as partner, or default partner name
      const partner = this.appId || 'default';

      // Wrap config in 'data' object with userId and partner as required by API
      const requestBody = {
        data: {
          userId: userId,
          partner: partner,
          data: config  // Nested data object contains the actual avatar config
        }
      };

      console.log('[ReadyPlayerMeProvider] Request body structure:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(
        `${this.baseUrl}/v1/avatars`,
        requestBody,
        {
          headers,
          timeout: 30000,
        }
      );

      if (!response.data || !response.data.id) {
        throw new Error('Invalid response from Ready Player Me API');
      }

      return response.data.id;
    } catch (error: any) {
      // Log detailed error information for debugging
      if (error.response) {
        console.error('[ReadyPlayerMeProvider] API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          config: JSON.stringify(config, null, 2),
        });
        throw new Error(`Ready Player Me API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  private async getModelUrl(avatarId: string): Promise<string> {
    // Get the GLB model URL for the avatar
    // Ready Player Me provides different formats: glb, gltf, etc.
    try {
      const headers: any = {
        'x-api-key': this.apiKey,  // lowercase header (not Authorization Bearer)
      };
      
      // Add App Key header if available
      if (this.appId) {
        headers['x-app-key'] = this.appId;  // lowercase header
      }

      const response = await axios.get(
        `${this.baseUrl}/v1/avatars/${avatarId}`,
        {
          headers,
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

