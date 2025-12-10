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

  async generateModel(description: CharacterDescription): Promise<GeneratedModel> {
    console.log('[MeshyProvider] Starting model generation...');
    
    if (!this.isAvailable()) {
      throw new Error('Meshy API key is not configured');
    }

    try {
      // Build prompt from character description
      const prompt = this.buildPrompt(description);
      
      // Step 1: Create a text-to-3D task
      const taskId = await this.createTask(prompt, description);
      console.log(`[MeshyProvider] Task created: ${taskId}`);

      // Step 2: Poll for task completion
      const result = await this.pollTask(taskId);
      console.log(`[MeshyProvider] Task completed: ${taskId}`);

      // Step 3: Get model URL
      const modelUrl = result.modelUrl || result.glbUrl || result.url;
      if (!modelUrl) {
        throw new Error('Meshy did not return a model URL');
      }

      return {
        modelId: `meshy_${taskId}`,
        modelUrl,
        format: AvatarModelFormat.GLB,
        metadata: {
          polygonCount: result.polygonCount || 8000,
          textureResolution: result.textureResolution || 2048,
          boneCount: result.boneCount || 60,
          animationCount: result.animationCount || 8,
        },
      };
    } catch (error: any) {
      console.error('[MeshyProvider] Generation error:', error);
      throw new Error(`Meshy generation failed: ${error.message}`);
    }
  }

  private async createTask(prompt: string, description: CharacterDescription): Promise<string> {
    // Meshy API endpoint for text-to-3D
    // Documentation: https://docs.meshy.ai/api-reference/text-to-3d
    const response = await axios.post(
      `${this.baseUrl}/v2/text-to-3d`,
      {
        prompt,
        mode: 'preview', // 'preview' for faster generation, 'hd' for higher quality
        art_style: this.mapToArtStyle(description.style),
        negative_prompt: 'blurry, low quality, distorted, deformed',
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
    const styleMap: Record<string, string> = {
      'anime': 'anime',
      'chibi': 'anime',
      'realistic': 'realistic',
      'cartoon': 'stylized',
      'robot': 'stylized',
      'fantasy': 'stylized',
    };
    return styleMap[style.toLowerCase()] || 'anime';
  }

  private async pollTask(
    taskId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
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

