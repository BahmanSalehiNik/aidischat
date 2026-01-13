import axios from 'axios';
import { BaseModelProvider } from './base-provider';
import { CharacterDescription } from '../character-description-generator';
import { GeneratedModel } from '../model-generator';
import { AvatarModelFormat } from '../../models/avatar';

/**
 * Meshy.ai provider implementation
 * Documentation: https://docs.meshy.ai/
 * 
 * For creating lightweight, textured, riggable models for mobile:
 * @see docs/MESHY_LIGHTWEIGHT_MODELS.md
 * 
 * For rigging and animation workflow:
 * @see docs/MESHY_RIGGING_ANIMATION.md
 * 
 * Key parameters for lightweight models:
 * - target_polycount: 6k-15k triangles for mobile AR characters
 * - topology: "triangle" (best for mobile)
 * - should_remesh: true (CRITICAL - must be true for polycount to work)
 * - enable_pbr: false (base color only, lighter)
 * - pose_mode: "t-pose" (essential for rigging)
 * 
 * Animation workflow:
 * - Generate minimal set: Idle (action_id: 0), Thinking (action_id: 25), Walk (action_id: 1)
 * - Each animation returns separate GLB - load rigged base + clips in engine
 * - Use 24 fps for mobile AR (lighter than 30/60)
 */
export class MeshyProvider extends BaseModelProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.meshy.ai');
  }

  getName(): string {
    return 'meshy';
  }

  async generateModel(description: CharacterDescription, agentId?: string): Promise<GeneratedModel> {
    console.log('[MeshyProvider] Starting lightweight model generation for mobile...');
    
    if (!this.isAvailable()) {
      throw new Error('Meshy API key is not configured');
    }

    try {
      // Build prompt from character description
      const prompt = this.buildPrompt(description);
      
      // Step 1: Create a text-to-3D preview task (geometry generation)
      // Using lightweight parameters for mobile optimization
      const taskId = await this.createTask(prompt, description);
      console.log(`[MeshyProvider] Preview task created: ${taskId}`);

      // Step 2: Poll for preview completion (geometry only, no texture yet)
      const previewResult = await this.pollTask(taskId);
      console.log(`[MeshyProvider] Preview completed: ${taskId}`);

      // Step 3: Refine the model (add textures)
      // This is the second stage of text-to-3d workflow
      // For lightweight models: @see docs/MESHY_LIGHTWEIGHT_MODELS.md
      let refinedModelUrl = previewResult.modelUrl || previewResult.glbUrl || previewResult.url;
      let refineTaskId: string | null = null;
      let refineResult: any = null;
      
      try {
        console.log(`[MeshyProvider] Starting texture refinement...`);
        refineTaskId = await this.createRefineTask(taskId, description);
        console.log(`[MeshyProvider] Refine task created: ${refineTaskId}`);
        
        refineResult = await this.pollRefineTask(refineTaskId);
        refinedModelUrl = refineResult.modelUrl || refinedModelUrl;
        console.log(`[MeshyProvider] Refinement completed: ${refineTaskId}`);
        console.log(`[MeshyProvider] Refined model URL: ${refinedModelUrl}`);
      } catch (error: any) {
        console.warn(`[MeshyProvider] Texture refinement failed: ${error.message}. Using preview model without textures.`);
        // Continue with untextured preview model
      }

      // Step 4: Optional remesh pass for final lightweight optimization
      // Use refine task ID if available, otherwise use preview task ID
      let finalModelUrl = refinedModelUrl;
      try {
        console.log(`[MeshyProvider] Starting remesh pass for final optimization...`);
        const remeshTaskId = refineTaskId || taskId; // Use refine task ID if available
        const remeshResult = await this.remeshModel(remeshTaskId);
        finalModelUrl = remeshResult.modelUrl || refinedModelUrl;
        console.log(`[MeshyProvider] Remesh completed - final model optimized for mobile`);
      } catch (error: any) {
        console.warn(`[MeshyProvider] Remesh failed: ${error.message}. Using model as-is.`);
        // Continue without remesh
      }

      // Step 5: Get final model URL
      // IMPORTANT: Use Meshy's URL directly for rigging (must be publicly accessible)
      // We'll download and store the final animated model, not intermediate versions
      let modelUrl = finalModelUrl;
      if (!modelUrl) {
        throw new Error('Meshy did not return a model URL');
      }

      console.log(`[MeshyProvider] Final model URL: ${modelUrl}`);
      console.log(`[MeshyProvider] Using Meshy URL directly for rigging (must be publicly accessible)`);

      // Step 6: Auto-rig the model (required for animations)
      //
      // CRITICAL: To preserve textures/materials in rigged outputs, prefer using Meshy's `input_task_id`
      // (the refine task id) instead of an external `model_url`. We observed that rigging via `model_url`
      // can return GLBs with 0 materials/textures.
      //
      // This does NOT do any merging/extraction/conversion on our side; it's purely using Meshy's API
      // in the recommended way.
      let riggedModelUrl = modelUrl;
      let rigTaskId: string | null = null;
      try {
        console.log(`[MeshyProvider] Starting auto-rigging for model...`);
        if (refineTaskId) {
          console.log(`[MeshyProvider] Using input_task_id for rigging (texture-preserving): ${refineTaskId}`);
          try {
            rigTaskId = await this.createRigTask({ inputTaskId: refineTaskId });
          } catch (error: any) {
            // If Meshy rejects rigging-by-task-id (common 422 for non-humanoids), retry via model_url.
            // This can be less reliable for preserving textures, but enables animations when it works.
            const status = error?.response?.status;
            const data = error?.response?.data;
            console.warn(`[MeshyProvider] Rigging via input_task_id failed${status ? ` (HTTP ${status})` : ''}: ${error?.message}`);
            if (data) console.warn(`[MeshyProvider] Rigging error response: ${JSON.stringify(data)}`);
            console.warn(`[MeshyProvider] Retrying rigging via model_url as fallback...`);
            rigTaskId = await this.createRigTask({ modelUrl });
          }
        } else {
          console.log(`[MeshyProvider] Model URL: ${modelUrl}`);
          rigTaskId = await this.createRigTask({ modelUrl });
        }
        console.log(`[MeshyProvider] Rig task created: ${rigTaskId}`);
        
        const rigResult = await this.pollRigTask(rigTaskId);
        riggedModelUrl = rigResult.modelUrl || modelUrl;
        console.log(`[MeshyProvider] Rigging completed: ${rigTaskId}`);
        console.log(`[MeshyProvider] Rigged model URL: ${riggedModelUrl}`);
        
        // Check if basic animations were included in rigging response
        if (rigResult.basicAnimations) {
          console.log(`[MeshyProvider] Basic animations included in rigging response (walking/running)`);
          // These can be used as fallback if custom animations fail
        }
      } catch (error: any) {
        const status = error?.response?.status;
        const data = error?.response?.data;
        console.warn(`[MeshyProvider] Auto-rigging failed${status ? ` (HTTP ${status})` : ''}: ${error?.message}`);
        if (data) console.warn(`[MeshyProvider] Rigging error response: ${JSON.stringify(data)}`);
        console.warn(`[MeshyProvider] Possible causes: model not humanoid, unclear body structure, or not in T-pose`);
        console.warn(`[MeshyProvider] Using unrigged model. Animations will not work.`);
        // Continue with unrigged model - animations won't work but model will still load
      }

      // Step 7: Add animations to the rigged model
      // For lightweight mobile AR: Generate minimal set (idle, thinking, walk)
      // See: docs/MESHY_RIGGING_ANIMATION.md
      let animatedModelUrl = riggedModelUrl;
      let animationUrls: string[] = [];
      let animationClips: Array<{ name: string; url: string }> = [];
      if (rigTaskId) {
        try {
          console.log(`[MeshyProvider] Adding animations to rigged model...`);
          console.log(`[MeshyProvider] Generating minimal animation set for mobile AR (idle, thinking, talking, walking)`);
          
          // Generate multiple animations (each returns separate GLB)
          // Recommended minimal set:
          // - Idle (0)
          // - Thinking (36 by default; configurable)
          // - Talking (3 by default; configurable - availability may vary by library version)
          // - Walking (1 by default; configurable)
          //
          // NOTE: Meshy action IDs can vary by library version. If a specific action_id fails,
          // Meshy will return an error and we will continue with remaining animations.
          const thinkingActionId = parseInt(process.env.MESHY_THINKING_ACTION_ID || '36', 10);
          const talkingActionId = parseInt(process.env.MESHY_TALKING_ACTION_ID || '3', 10);
          const walkingActionId = parseInt(process.env.MESHY_WALKING_ACTION_ID || '1', 10);

          const animationSet = [
            { name: 'idle', action_id: 0 }, // Idle
            { name: 'thinking', action_id: thinkingActionId }, // Thinking / gesture-style
            { name: 'talking', action_id: talkingActionId }, // Talking (if available)
            { name: 'walking', action_id: walkingActionId }, // Walking
          ];
          
          const animationResults = await this.addMultipleAnimations(rigTaskId, animationSet);
          animationClips = animationResults.filter(r => !!r.url);
          animationUrls = animationClips.map(r => r.url);
          
          // IMPORTANT: Keep rigged base character URL as modelUrl
          // Animations are separate GLBs that should be loaded as clips in the engine
          // The rigged base character is what you'll use, with animation clips applied to it
          // See: docs/MESHY_RIGGING_ANIMATION.md for how to use animations
          animatedModelUrl = riggedModelUrl; // Use rigged base, not animation URL
          
          console.log(`[MeshyProvider] Animations added: ${animationUrls.length} animations`);
          console.log(`[MeshyProvider] Rigged base character: ${riggedModelUrl}`);
          console.log(`[MeshyProvider] Animation clips:`, animationClips);
          console.log(`[MeshyProvider] Note: Load rigged base character + animation clips separately in engine`);
        } catch (error: any) {
          console.warn(`[MeshyProvider] Animation addition failed: ${error.message}`);
          console.warn(`[MeshyProvider] Using rigged model without animations.`);
          // Continue with rigged but unanimated model
        }
      }

      return {
        modelId: `meshy_${taskId}`,
        modelUrl: animatedModelUrl, // Rigged base character URL
        animationClips: animationClips.length > 0 ? animationClips : undefined,
        animationUrls: animationUrls.length > 0 ? animationUrls : undefined, // Separate animation GLB URLs
        format: AvatarModelFormat.GLB,
        metadata: {
          polygonCount: previewResult?.polygonCount || refineResult?.polygonCount || 10000, // Target: 6k-15k for mobile
          textureResolution: refineResult?.textureResolution || 1024, // Lower for mobile (base color only, enable_pbr: false)
          boneCount: 60, // Standard humanoid rig
          animationCount: animationUrls.length || 0,
        },
      };
    } catch (error: any) {
      console.error('[MeshyProvider] Generation error:', error);
      throw new Error(`Meshy generation failed: ${error.message}`);
    }
  }

  private async createTask(prompt: string, description: CharacterDescription): Promise<string> {
    // Meshy API endpoint for text-to-3D Preview stage (geometry generation)
    // Documentation: https://docs.meshy.ai/api-reference/text-to-3d
    // For lightweight models guide: @see docs/MESHY_LIGHTWEIGHT_MODELS.md
    // 
    // Text-to-3D is two-stage: Preview (geometry) → Refine (texture)
    // This is Stage 1: Preview - generates geometry only (no textures yet)
    
    // Enhance prompt for rigging compatibility.
    // Meshy can still output non‑T‑pose characters unless we are very explicit in the text prompt.
    // A strict T‑pose dramatically increases the success rate of Meshy rigging + animation generation.
    const enhancedPrompt =
      `${prompt}, ` +
      `full body humanoid character in a STRICT T-POSE (arms straight out horizontally at shoulder height, elbows straight, palms down), ` +
      `legs straight, feet shoulder-width apart, neutral face, front-facing, centered, ` +
      `simple clean silhouette, game-ready, mobile-optimized`;
    const negativePrompt =
      'blurry, low quality, distorted, deformed, complex pose, dynamic pose, action pose, walking, running, sitting, crouching, kneeling, jumping, dancing, ' +
      'A-pose, arms down, arms bent, elbows bent, hands on hips, crossed arms, ' +
      'high poly, extremely detailed geometry, cluttered accessories, cropped body';
    
    // Mobile-optimized parameters for lightweight models
    // target_polycount: 6k-15k for AR characters (using 10k as middle ground)
    // topology: "triangle" - best for mobile runtime
    // should_remesh: true - CRITICAL: must be true for target_polycount to work
    // pose_mode: "t-pose" - essential for humanoid rigging
    // Build request body for preview mode
    // According to Meshy docs, preview mode supports:
    // - Required: prompt, mode, art_style, negative_prompt, should_remesh
    // - Optional: target_polycount, topology, pose_mode, ai_model
    // 
    // NOTE: Some API plans may not support optional parameters.
    // If you get parameter errors, set MESHY_USE_LIGHTWEIGHT_PARAMS=false
    const requestBody: any = {
      prompt: enhancedPrompt,
      mode: 'preview', // Preview stage: generates geometry (no textures yet)
      art_style: this.mapToArtStyle(description.style),
      negative_prompt: negativePrompt,
      should_remesh: true, // CRITICAL: Must be true for lightweight models
    };

    // Lightweight parameters (optional - may not be supported in all API plans)
    // Set via environment variable: MESHY_USE_LIGHTWEIGHT_PARAMS=true/false
    // Default: true (try to use lightweight params, fallback if they fail)
    const useLightweightParams = process.env.MESHY_USE_LIGHTWEIGHT_PARAMS !== 'false';
    
    if (useLightweightParams) {
      // These parameters help create lightweight models for mobile
      // If they cause errors, set MESHY_USE_LIGHTWEIGHT_PARAMS=false
      requestBody.target_polycount = 8000; // Sweet spot for mobile AR characters (100-300,000 valid range)
      requestBody.topology = 'triangle'; // Best for mobile runtime
      requestBody.pose_mode = 't-pose'; // Essential for rigging
      requestBody.symmetry_mode = 'auto'; // Helps consistency
      console.log('[MeshyProvider] Using lightweight parameters:', {
        target_polycount: requestBody.target_polycount,
        topology: requestBody.topology,
        pose_mode: requestBody.pose_mode,
      });
    } else {
      console.log('[MeshyProvider] Lightweight parameters disabled - using minimal request');
      console.log('[MeshyProvider] Will use remesh API after generation for optimization');
    }

    // Optional: ai_model parameter (if you want to specify which model version)
    // requestBody.ai_model = 'meshy-5'; // or 'latest' for Meshy 6 Preview

    try {
      const response = await axios.post(
        `${this.baseUrl}/openapi/v2/text-to-3d`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      // Check for error in response
      if (response.data.error) {
        throw new Error(`Meshy API error: ${response.data.error.message || response.data.error}`);
      }

      if (!response.data || !response.data.result) {
        console.error('[MeshyProvider] Invalid response structure:', JSON.stringify(response.data, null, 2));
        throw new Error('Invalid response from Meshy API - no result field');
      }

      return response.data.result;
    } catch (error: any) {
      // Enhanced error logging
      if (error.response) {
        console.error('[MeshyProvider] Meshy API error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });
        throw new Error(`Meshy API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
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
          `${this.baseUrl}/openapi/v2/text-to-3d/${taskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
            timeout: 30000, // Increased timeout for Meshy API (30 seconds)
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
        // Handle timeout errors - retry if it's a network timeout
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
          console.warn(`[MeshyProvider] Timeout polling task ${taskId}, attempt ${attempts + 1}/${maxAttempts}. Retrying...`);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            continue;
          }
          throw new Error(`Meshy task ${taskId} polling timed out after ${maxAttempts} attempts`);
        }
        
        // Handle 404 - task might still be creating
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
   * For rigging guide: @see docs/MESHY_RIGGING_ANIMATION.md
   * API Endpoint: POST /openapi/v1/rigging
   * 
   * Requirements:
   * - Model must be publicly accessible via URL
   * - Model should be in T-pose or A-pose for best results
   * - Model must be textured (Meshy text-to-3d always textures)
   * - Model must be humanoid with clear limb/body structure
   * 
   * Response includes:
   * - rigged_character_glb_url: Base rigged character
   * - basic_animations: Optional walking/running animations
   */
  private async createRigTask(modelUrl: string): Promise<string>;
  private async createRigTask(args: { modelUrl?: string; inputTaskId?: string }): Promise<string>;
  private async createRigTask(arg: string | { modelUrl?: string; inputTaskId?: string }): Promise<string> {
    const body: any = {
      rig_preset: 'STANDARD_HUMANOID', // Explicit preset for humanoid characters
      height_meters: 1.75, // Improves skeleton scaling
    };

    if (typeof arg === 'string') {
      body.model_url = arg;
    } else if (arg.inputTaskId) {
      // Meshy supports rigging by task id (e.g., refine_task_id) which can preserve textures/materials.
      body.input_task_id = arg.inputTaskId;
    } else if (arg.modelUrl) {
      body.model_url = arg.modelUrl;
    } else {
      throw new Error('createRigTask requires either modelUrl or inputTaskId');
    }

    const response = await axios.post(`${this.baseUrl}/openapi/v1/rigging`, body, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Response structure: { "result": "rigging_task_id" } or { "rigging_task_id": "..." }
    const taskId = response.data.result || response.data.rigging_task_id || response.data.id;
    if (!taskId) {
      throw new Error('Invalid response from Meshy rigging API');
    }

    return taskId;
  }

  /**
   * Poll for rigging task completion
   * API Endpoint: GET /openapi/v1/rigging/{id}
   * For rigging guide: @see docs/MESHY_RIGGING_ANIMATION.md
   */
  private async pollRigTask(
    taskId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<{ modelUrl: string; basicAnimations?: any }> {
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
          // Rigging response structure: result.rigged_character_glb_url
          // See: docs/MESHY_RIGGING_ANIMATION.md for response structure
          const result = response.data.result || response.data;
          return {
            modelUrl: result.rigged_character_glb_url ||
                     result.rigged_character_fbx_url ||
                     result.model_urls?.glb || 
                     result.model_urls?.gltf || 
                     result.model_url || 
                     result.url || '',
            // Basic animations may be included in rigging response (walking/running)
            basicAnimations: result.basic_animations || null,
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
        // Handle timeout errors - retry if it's a network timeout
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
          console.warn(`[MeshyProvider] Timeout polling task ${taskId}, attempt ${attempts + 1}/${maxAttempts}. Retrying...`);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            continue;
          }
          throw new Error(`Meshy task ${taskId} polling timed out after ${maxAttempts} attempts`);
        }
        
        // Handle 404 - task might still be creating
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
   * Add multiple animations to a rigged model
   * Documentation: https://docs.meshy.ai/en/api/rigging-and-animation
   * For animation guide: @see docs/MESHY_RIGGING_ANIMATION.md
   * 
   * Each animation is generated separately and returns its own GLB.
   * You'll need to load the rigged base character + animation clips in your engine.
   */
  private async addMultipleAnimations(
    rigTaskId: string,
    animations: Array<{ name: string; action_id: number }>
  ): Promise<Array<{ name: string; url: string }>> {
    const results: Array<{ name: string; url: string }> = [];
    
    // Generate each animation separately
    for (const anim of animations) {
      try {
        console.log(`[MeshyProvider] Generating ${anim.name} animation (action_id: ${anim.action_id})...`);
        
        const response = await axios.post(
          `${this.baseUrl}/openapi/v1/animations`,
          {
            rig_task_id: rigTaskId,
            action_id: anim.action_id,
            post_process: {
              operation_type: 'change_fps',
              fps: 24, // 24 fps recommended for mobile AR (lighter than 30/60)
            },
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
        );

        // Response structure: { "result": "animation_task_id" }
        const animTaskId = response.data.result || response.data.animation_task_id || response.data.id;
        if (!animTaskId) {
          throw new Error('Invalid response from Meshy animation API');
        }

        // Poll for animation completion
        const animResult = await this.pollAnimationTask(animTaskId);
        
        results.push({
          name: anim.name,
          url: animResult.modelUrl || '',
        });
        
        console.log(`[MeshyProvider] ✅ ${anim.name} animation completed: ${animResult.modelUrl}`);
      } catch (error: any) {
        console.warn(`[MeshyProvider] Failed to generate ${anim.name} animation: ${error.message}`);
        // Continue with other animations
      }
    }
    
    return results;
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
          // Animation response structure: result.animation_glb_url
          const result = response.data.result || response.data;
          return {
            modelUrl: result.animation_glb_url ||
                     result.animation_fbx_url ||
                     result.model_urls?.glb || 
                     result.model_urls?.gltf || 
                     result.model_url || 
                     result.url || '',
            animationUrls: result.animation_urls || 
                          result.animations || 
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
        // Handle timeout errors - retry if it's a network timeout
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
          console.warn(`[MeshyProvider] Timeout polling task ${taskId}, attempt ${attempts + 1}/${maxAttempts}. Retrying...`);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            continue;
          }
          throw new Error(`Meshy task ${taskId} polling timed out after ${maxAttempts} attempts`);
        }
        
        // Handle 404 - task might still be creating
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

  /**
   * Create a refine task to add textures to the preview model
   * This is Stage 2 of text-to-3d workflow (Preview → Refine)
   * Documentation: https://docs.meshy.ai/api-reference/text-to-3d
   * For lightweight models: @see docs/MESHY_LIGHTWEIGHT_MODELS.md
   * 
   * Refine stage supports lightweight parameters:
   * - enable_pbr: false (base color only, lighter)
   * - texture_prompt: optional texturing prompt
   * - texture_image_url: optional reference image
   */
  private async createRefineTask(previewTaskId: string, description: CharacterDescription): Promise<string> {
    const requestBody: any = {
      mode: 'refine', // Refine stage: adds textures to preview geometry
      preview_task_id: previewTaskId,
      // Lightweight texture settings
      enable_pbr: false, // Base color only (lighter & faster for mobile)
    };

    // Optional: texture_prompt or texture_image_url for custom texturing
    // requestBody.texture_prompt = 'same as original prompt';
    
    const response = await axios.post(
      `${this.baseUrl}/openapi/v2/text-to-3d`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    // Check for error in response
    if (response.data.error) {
      throw new Error(`Meshy refine API error: ${response.data.error.message || response.data.error}`);
    }

    if (!response.data || !response.data.result) {
      console.error('[MeshyProvider] Invalid refine response:', JSON.stringify(response.data, null, 2));
      throw new Error('Invalid response from Meshy refine API - no result field');
    }

    return response.data.result;
  }

  /**
   * Poll for refine task completion
   * Returns textured model URL
   */
  private async pollRefineTask(
    taskId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<any> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/openapi/v2/text-to-3d/${taskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
            timeout: 30000, // Increased timeout for Meshy API (30 seconds)
          }
        );

        const status = response.data.status || response.data.progress?.status;
        
        if (status === 'SUCCEEDED' || status === 'COMPLETED') {
          // Refine stage returns textured model
          return {
            modelUrl: response.data.model_urls?.glb || 
                     response.data.model_urls?.gltf || 
                     response.data.model_url || 
                     response.data.url,
            polygonCount: response.data.polygon_count,
            textureResolution: response.data.texture_resolution,
          };
        } else if (status === 'FAILED' || status === 'ERROR') {
          throw new Error(`Meshy refine task failed: ${response.data.error || response.data.message || 'Unknown error'}`);
        } else {
          const progress = response.data.progress?.percentage || 
                          response.data.progress || 
                          response.data.percentage || 
                          0;
          console.log(`[MeshyProvider] Refine task ${taskId} progress: ${progress}%`);
          
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
        }
      } catch (error: any) {
        // Handle timeout errors - retry if it's a network timeout
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
          console.warn(`[MeshyProvider] Timeout polling task ${taskId}, attempt ${attempts + 1}/${maxAttempts}. Retrying...`);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            continue;
          }
          throw new Error(`Meshy task ${taskId} polling timed out after ${maxAttempts} attempts`);
        }
        
        // Handle 404 - task might still be creating
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

    throw new Error(`Meshy refine task ${taskId} timed out after ${maxAttempts} attempts`);
  }

  /**
   * Remesh model for final lightweight optimization
   * This is an optional pass to further optimize the model for mobile
   * Documentation: https://docs.meshy.ai/api/remesh
   * For lightweight models: @see docs/MESHY_LIGHTWEIGHT_MODELS.md
   */
  private async remeshModel(inputTaskId: string): Promise<{ modelUrl: string }> {
    const response = await axios.post(
      `${this.baseUrl}/openapi/v1/remesh`,
      {
        input_task_id: inputTaskId, // Use task ID instead of model URL
        target_formats: ['glb'],
        topology: 'triangle', // Best for mobile
        target_polycount: 8000, // Sweet spot for mobile AR characters
        resize_height: 1.7, // Character height in meters (AR-friendly)
        origin_at: 'bottom', // Character stands on AR plane nicely
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
      throw new Error('Invalid response from Meshy remesh API');
    }

    const remeshTaskId = response.data.result;
    
    // Poll for remesh task completion
    return await this.pollRemeshTask(remeshTaskId);
  }

  /**
   * Poll for remesh task completion
   */
  private async pollRemeshTask(
    taskId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<{ modelUrl: string }> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/openapi/v1/remesh/${taskId}`,
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
          };
        } else if (status === 'FAILED' || status === 'ERROR') {
          throw new Error(`Meshy remesh task failed: ${response.data.error || response.data.message || 'Unknown error'}`);
        } else {
          const progress = response.data.progress?.percentage || 
                          response.data.progress || 
                          response.data.percentage || 
                          0;
          console.log(`[MeshyProvider] Remesh task ${taskId} progress: ${progress}%`);
          
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
        }
      } catch (error: any) {
        // Handle timeout errors - retry if it's a network timeout
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
          console.warn(`[MeshyProvider] Timeout polling task ${taskId}, attempt ${attempts + 1}/${maxAttempts}. Retrying...`);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            continue;
          }
          throw new Error(`Meshy task ${taskId} polling timed out after ${maxAttempts} attempts`);
        }
        
        // Handle 404 - task might still be creating
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

    throw new Error(`Meshy remesh task ${taskId} timed out after ${maxAttempts} attempts`);
  }
}

