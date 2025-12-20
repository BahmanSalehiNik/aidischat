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
      let modelUrl = result.modelUrl || result.glbUrl || result.url;
      if (!modelUrl) {
        throw new Error('Meshy did not return a model URL');
      }

      // Step 4: Auto-rig the model (required for animations)
      let riggedModelUrl = modelUrl;
      let rigTaskId: string | null = null;
      try {
        console.log(`[MeshyProvider] Starting auto-rigging for model...`);
        rigTaskId = await this.createRigTask(modelUrl);
        console.log(`[MeshyProvider] Rig task created: ${rigTaskId}`);
        
        const rigResult = await this.pollRigTask(rigTaskId);
        riggedModelUrl = rigResult.modelUrl || modelUrl;
        console.log(`[MeshyProvider] Rigging completed: ${rigTaskId}`);
      } catch (error: any) {
        console.warn(`[MeshyProvider] Auto-rigging failed: ${error.message}. Using unrigged model.`);
        // Continue with unrigged model - animations won't work but model will still load
      }

      // Step 5: Add animations to the rigged model
      let animatedModelUrl = riggedModelUrl;
      let animationUrls: string[] = [];
      if (rigTaskId) {
        try {
          console.log(`[MeshyProvider] Adding animations to rigged model...`);
          const animResult = await this.addAnimations(rigTaskId);
          animatedModelUrl = animResult.modelUrl || riggedModelUrl;
          animationUrls = animResult.animationUrls || [];
          console.log(`[MeshyProvider] Animations added: ${animationUrls.length} animations`);
        } catch (error: any) {
          console.warn(`[MeshyProvider] Animation addition failed: ${error.message}. Using model without animations.`);
          // Continue with unanimated model
        }
      }

      return {
        modelId: `meshy_${taskId}`,
        modelUrl: animatedModelUrl, // Use animated model if available, otherwise rigged, otherwise original
        format: AvatarModelFormat.GLB,
        metadata: {
          polygonCount: result.polygonCount || 8000,
          textureResolution: result.textureResolution || 2048,
          boneCount: result.boneCount || 60,
          animationCount: animationUrls.length || 0,
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

  /**
   * Create an auto-rigging task for a generated model
   * Documentation: https://docs.meshy.ai/en/api/rigging-and-animation
   * API Endpoint: POST /openapi/v1/rigging
   */
  private async createRigTask(modelUrl: string): Promise<string> {
    const response = await axios.post(
      `${this.baseUrl}/openapi/v1/rigging`,
      {
        model_url: modelUrl,
        // Optional: rig_preset can be "STANDARD_HUMANOID" or "QUADRUPED"
        // Meshy auto-detects for humanoid characters if not specified
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (!response.data || !response.data.rigging_task_id) {
      throw new Error('Invalid response from Meshy rigging API');
    }

    return response.data.rigging_task_id;
  }

  /**
   * Poll for rigging task completion
   * API Endpoint: GET /openapi/v1/rigging/{id}
   */
  private async pollRigTask(
    taskId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<any> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/openapi/v1/rigging/${taskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
            timeout: 10000,
          }
        );

        const status = response.data.status || response.data.progress?.status;
        
        if (status === 'SUCCEEDED' || status === 'COMPLETED') {
          return {
            modelUrl: response.data.model_urls?.glb || 
                     response.data.model_urls?.gltf || 
                     response.data.model_url || 
                     response.data.url,
          };
        } else if (status === 'FAILED' || status === 'ERROR') {
          throw new Error(`Meshy rigging task failed: ${response.data.error || response.data.message || 'Unknown error'}`);
        } else {
          const progress = response.data.progress?.percentage || 
                          response.data.progress || 
                          response.data.percentage || 
                          0;
          console.log(`[MeshyProvider] Rigging task ${taskId} progress: ${progress}%`);
          
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            continue;
          }
        }
        throw error;
      }
    }

    throw new Error(`Meshy rigging task ${taskId} timed out after ${maxAttempts} attempts`);
  }

  /**
   * Add animations to a rigged model
   * Documentation: https://docs.meshy.ai/en/api/rigging-and-animation
   * API Endpoint: POST /openapi/v1/animations
   * Note: Meshy has an animation library with action_id values - you need to specify action_id
   * See: https://docs.meshy.ai/api/animation-library for available animations
   */
  private async addAnimations(rigTaskId: string): Promise<{ modelUrl: string; animationUrls: string[] }> {
    // Meshy animation API - apply predefined animations
    // You need to use action_id from Meshy's animation library
    // Common action_ids (these are examples - check Meshy docs for actual IDs):
    // - Idle: typically around 1-10
    // - Walking: typically around 100-200
    // - Talking: typically around 300-400
    // For now, we'll request a default idle animation (action_id: 1)
    // TODO: Map movement states to actual Meshy action_id values from their library
    
    const response = await axios.post(
      `${this.baseUrl}/openapi/v1/animations`,
      {
        rig_task_id: rigTaskId,
        action_id: 1, // Default idle animation - TODO: map to actual Meshy action_ids
        fps: 30, // Optional: frames per second
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (!response.data || !response.data.animation_task_id) {
      throw new Error('Invalid response from Meshy animation API');
    }

    const animTaskId = response.data.animation_task_id;
    
    // Poll for animation task completion
    const animResult = await this.pollAnimationTask(animTaskId);
    
    return {
      modelUrl: animResult.modelUrl || '',
      animationUrls: animResult.animationUrls || [],
    };
  }

  /**
   * Poll for animation task completion
   * API Endpoint: GET /openapi/v1/animations/{id}
   */
  private async pollAnimationTask(
    taskId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<{ modelUrl: string; animationUrls: string[] }> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/openapi/v1/animations/${taskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
            timeout: 10000,
          }
        );

        const status = response.data.status || response.data.progress?.status;
        
        if (status === 'SUCCEEDED' || status === 'COMPLETED') {
          return {
            modelUrl: response.data.model_urls?.glb || 
                     response.data.model_urls?.gltf || 
                     response.data.model_url || 
                     response.data.url || '',
            animationUrls: response.data.animation_urls || 
                          response.data.animations || 
                          [],
          };
        } else if (status === 'FAILED' || status === 'ERROR') {
          throw new Error(`Meshy animation task failed: ${response.data.error || response.data.message || 'Unknown error'}`);
        } else {
          const progress = response.data.progress?.percentage || 
                          response.data.progress || 
                          response.data.percentage || 
                          0;
          console.log(`[MeshyProvider] Animation task ${taskId} progress: ${progress}%`);
          
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            continue;
          }
        }
        throw error;
      }
    }

    throw new Error(`Meshy animation task ${taskId} timed out after ${maxAttempts} attempts`);
  }
}

