import axios from 'axios';
import { BaseModelProvider } from './base-provider';
import { CharacterDescription } from '../character-description-generator';
import { GeneratedModel } from '../model-generator';
import { AvatarModelFormat } from '../../models/avatar';

/**
 * Meshy.ai provider implementation
 * Documentation: https://docs.meshy.ai/
 */
export class MeshyProvider extends BaseModelProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.meshy.ai');
  }

  getName(): string {
    return 'meshy';
  }

  async generateModel(description: CharacterDescription, agentId?: string): Promise<GeneratedModel> {
    console.log('[MeshyProvider] Starting fast model generation (preview with basic colors)...');
    
    if (!this.isAvailable()) {
      throw new Error('Meshy API key is not configured');
    }

    try {
      // Build prompt from character description
      const prompt = this.buildPrompt(description);
      
      // Use preview mode only - much faster, skip refine stage
      // Preview can include basic colors if we request it in the prompt
      const taskId = await this.createTask(prompt, description);
      console.log(`[MeshyProvider] Task created: ${taskId}`);

      // Poll for completion
      const result = await this.pollTask(taskId);
      console.log(`[MeshyProvider] Task completed: ${taskId}`);

      // Get model URL
      const modelUrl = result.modelUrl || result.glbUrl || result.url;
      if (!modelUrl) {
        throw new Error('Meshy did not return a model URL');
      }

      return {
        modelId: `meshy_${taskId}`,
        modelUrl,
        format: AvatarModelFormat.GLB,
        metadata: {
          polygonCount: result.polygonCount || 5000,
          textureResolution: result.textureResolution || 256, // Minimal texture
          boneCount: result.boneCount || 30,
          animationCount: result.animationCount || 4,
        },
      };
    } catch (error: any) {
      console.error('[MeshyProvider] Generation error:', error);
      throw new Error(`Meshy generation failed: ${error.message}`);
    }
  }

  private async createTask(prompt: string, description: CharacterDescription): Promise<string> {
    // Enhance prompt to request full body, colors, and detailed facial features for visemes
    const enhancedPrompt = `${prompt}, full body character, colorful, vibrant colors, highly detailed face with clear mouth, lips, eyes, and facial expressions for lip sync animation, expressive features, simple textures but with color`;
    
    // Meshy API endpoint for text-to-3D
    // Documentation: https://docs.meshy.ai/api-reference/text-to-3d
    const response = await axios.post(
      `${this.baseUrl}/v2/text-to-3d`,
      {
        prompt: enhancedPrompt,
        mode: 'preview', // Preview mode only - fastest option
        art_style: this.mapToArtStyle(description.style),
        negative_prompt: 'blurry, low quality, distorted, deformed, grayscale, monochrome, upper body only, head only, no colors, colorless',
        // Ultra-light settings for fastest generation with basic colors
        target_polycount: 4000, // Very low polygon count for speed (default 30k)
        topology: 'triangle', // Triangle mesh is fastest
        should_remesh: false, // Disable remeshing for speed
        symmetry_mode: 'off', // Disable symmetry check for speed
        ai_model: 'meshy-4', // Use faster model version
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (!response.data || !response.data.result) {
      throw new Error('Invalid response from Meshy API');
    }

    return response.data.result;
  }

  private mapToArtStyle(style: string): string {
    // Map character style to Meshy art style
    // Note: Available art styles may vary by API plan
    // Common values: realistic, cartoon, low-poly, sculpture, pbr
    // For this account, only realistic and sculpture are available
    const styleMap: Record<string, string> = {
      'anime': 'sculpture',
      'chibi': 'sculpture',
      'realistic': 'realistic',
      'cartoon': 'sculpture',
      'robot': 'sculpture',
      'fantasy': 'sculpture',
      'stylized': 'sculpture',
    };
    // Default to sculpture for character avatars (more stylized)
    return styleMap[style.toLowerCase()] || 'sculpture';
  }

  private async pollTask(
    taskId: string,
    maxAttempts: number = 60, // Preview is faster, less attempts needed
    intervalMs: number = 8000 // Check every 8s (balance between speed and API calls)
  ): Promise<any> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/v2/text-to-3d/${taskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
            timeout: 10000,
          }
        );

        const status = response.data.status || response.data.progress?.status;
        
        if (status === 'SUCCEEDED' || status === 'COMPLETED') {
          // Task completed successfully
          return {
            modelUrl: response.data.model_urls?.glb || 
                     response.data.model_urls?.gltf || 
                     response.data.model_url || 
                     response.data.url,
            polygonCount: response.data.polygon_count,
            textureResolution: response.data.texture_resolution,
            boneCount: response.data.bone_count,
            animationCount: response.data.animation_count,
          };
        } else if (status === 'FAILED' || status === 'ERROR') {
          throw new Error(`Meshy task failed: ${response.data.error || response.data.message || 'Unknown error'}`);
        } else {
          // Still processing
          const progress = response.data.progress?.percentage || 
                          response.data.progress || 
                          response.data.percentage || 
                          0;
          console.log(`[MeshyProvider] Task ${taskId} progress: ${progress}%`);
          
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Task not found, might still be creating
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            continue;
          }
        }
        throw error;
      }
    }

    throw new Error(`Meshy task ${taskId} timed out after ${maxAttempts} attempts`);
  }
}

