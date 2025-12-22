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
 * - enable_pbr: false (base color only, lighter) - CRITICAL for colors
 * - pose_mode: "t-pose" (essential for rigging)
 * 
 * Color pipeline (Base-color textures only):
 * - Colors stored in one BaseColor texture (no PBR maps)
 * - Separate materials for skin, hair, eyes, clothing (enables runtime color swapping)
 * - No normal/roughness/metallic maps (lighter & faster)
 * - Lighting from engine, not textures (no baked lighting)
 * - Texture prompt includes specific color guidance for all body parts
 * - Optimized for mobile AR (512-1024px textures, < 2-3MB total)
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

  /**
   * Generate a 3D model with BOTH colors (textures) and animations
   * 
   * Complete Flow (Option A pattern for Three.js React Native):
   * 1. Preview → Generate geometry (Text-to-3D preview mode)
   * 2. Refine → Add colors/textures (skin, hair, eyes, clothes) - CRITICAL for colors
   * 3. Optional Remesh → Final optimization (after texturing)
   * 4. Rig → Add skeleton for animations (preserves textures from refine)
   * 5. Animate → Generate animation clips (idle, wave, thinking) + collect basic animations
   * 
   * Result:
   * - Base character: rigged_character_glb_url (ONE heavy file: mesh + textures + skeleton)
   * - Animation assets: separate lightweight files (armature GLBs or animation clips)
   * 
   * For complete flow documentation, see: docs/MESHY_COLOR_AND_ANIMATION_FLOW.md
   * 
   * @param description Character description with colors (hair, eyes, clothing)
   * @param agentId Optional agent ID for tracking
   * @returns Generated model with modelUrl (base character) and animationUrls (clips)
   */
  async generateModel(description: CharacterDescription, agentId?: string): Promise<GeneratedModel> {
    console.log('[MeshyProvider] Starting lightweight model generation for mobile...');
    console.log('[MeshyProvider] Flow: Preview → Refine (textures/colors) → Optional Remesh → Rig → Animate');
    console.log('[MeshyProvider] Target: Base character (colors + rig) + Separate animation clips (Option A)');
    console.log('[MeshyProvider] Using Text-to-3D Refine API (correct flow for colors per Meshy docs)');
    
    if (!this.isAvailable()) {
      throw new Error('Meshy API key is not configured');
    }

    try {
      // Build prompt from character description
      const prompt = this.buildPrompt(description);
      
      // Step 1: Create a text-to-3D preview task (geometry generation)
      // Using lightweight parameters for mobile optimization
      // Alternative: Use Image-to-3D with should_texture:true for single-step generation
      // See: docs/MESHY_COLOR_AND_ANIMATION_FLOW.md
      const taskId = await this.createTask(prompt, description);
      console.log(`[MeshyProvider] Preview task created: ${taskId}`);

      // Step 2: Poll for preview completion (geometry only, no texture yet)
      const previewResult = await this.pollTask(taskId);
      console.log(`[MeshyProvider] Preview completed: ${taskId}`);
      const previewModelUrl = previewResult.modelUrl || previewResult.glbUrl || previewResult.url;
      if (!previewModelUrl) {
        throw new Error('Preview model URL not available');
      }

      // Step 3: SKIP Refine - we'll add textures AFTER rigging
      // Flow: Mesh (Preview) → Rig → Texture (Retexture API)
      // This is the correct order: mesh → rig → texture
      console.log(`[MeshyProvider] ✅ SKIPPING Refine step - textures will be added AFTER rigging`);
      console.log(`[MeshyProvider] ✅ Flow: Preview (mesh) → Rig → Retexture (colors)`);
      console.log(`[MeshyProvider] ✅ This ensures: Mesh + Rig + Materials + Textures (colors) in correct order`);
      
      let texturedModelUrl = previewModelUrl; // Will be updated after rigging
      let refineSucceeded = false; // Not using refine anymore

      // Step 4: Auto-rig the PREVIEW model (geometry only, no textures)
      // Flow: Mesh (Preview) → Rig → Texture (Retexture API)
      // This ensures: Mesh + Rig + Materials + Textures (colors) in correct order
      let riggedModelUrl = previewModelUrl; // Start with preview (fallback)
      let rigTaskId: string | null = null;
      let riggingSucceeded = false;
      let rigResult: { modelUrl: string; basicAnimations?: any } | null = null;
      
      try {
        console.log(`[MeshyProvider] 🦴 Starting auto-rigging for PREVIEW model (geometry only)...`);
        console.log(`[MeshyProvider] 🦴 Input model URL for rigging: ${previewModelUrl}`);
        console.log(`[MeshyProvider] 🦴 Flow: Mesh (Preview) → Rig → Texture (after rigging)`);
        console.log(`[MeshyProvider] 🦴 This ensures textures are added AFTER rigging (correct order)`);
        rigTaskId = await this.createRigTask(previewModelUrl, undefined); // No texture URL - textures come after
        console.log(`[MeshyProvider] 🦴 Rig task created: ${rigTaskId}`);
        
        rigResult = await this.pollRigTask(rigTaskId);
        
        // Validate rigged model URL
        if (!rigResult.modelUrl || rigResult.modelUrl.trim() === '') {
          throw new Error('Rigging API returned empty model URL');
        }
        
        riggedModelUrl = rigResult.modelUrl;
        riggingSucceeded = true;
        console.log(`[MeshyProvider] ✅ Rigging completed: ${rigTaskId}`);
        console.log(`[MeshyProvider] ✅ Rigged model URL (geometry + skeleton, NO textures yet): ${riggedModelUrl}`);
        console.log(`[MeshyProvider] ✅ Next step: Add textures/colors to rigged model using Retexture API`);
        
        // Verify rigged model URL is different
        if (riggedModelUrl === previewModelUrl) {
          console.warn(`[MeshyProvider] ⚠️ WARNING: Rigging returned same URL as input. Rigging may not have been applied.`);
        }
        
        // Log basic animations availability
        if (rigResult.basicAnimations) {
          console.log(`[MeshyProvider] ✅ Basic animations available in rigging response`);
          console.log(`[MeshyProvider]    - walking_armature_glb_url: ${rigResult.basicAnimations.walking_armature_glb_url || 'NOT AVAILABLE'}`);
          console.log(`[MeshyProvider]    - running_armature_glb_url: ${rigResult.basicAnimations.running_armature_glb_url || 'NOT AVAILABLE'}`);
        }
      } catch (error: any) {
        console.error(`[MeshyProvider] ❌ Auto-rigging FAILED: ${error.message}`);
        console.error(`[MeshyProvider] ❌ Error details:`, error);
        if (error.response) {
          console.error(`[MeshyProvider] ❌ API Response:`, {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
          });
        }
        console.warn(`[MeshyProvider] ⚠️ Possible causes: model not humanoid, unclear body structure, or not in T-pose`);
        console.warn(`[MeshyProvider] ⚠️ Using unrigged model. Animations will not work.`);
        // Fallback to preview model (no rig, no textures)
        riggedModelUrl = previewModelUrl;
        console.log(`[MeshyProvider] ✅ Fallback: Using preview model URL (no rig, no textures): ${riggedModelUrl}`);
      }
      
      // Step 5: Add textures/colors to the RIGGED model (AFTER rigging)
      // Flow: Mesh → Rig → Texture (colors)
      // Use Retexture API to add colors to the rigged model
      if (riggingSucceeded && riggedModelUrl) {
        try {
          console.log(`[MeshyProvider] 🎨 Adding textures/colors to RIGGED model (after rigging)...`);
          console.log(`[MeshyProvider] 🎨 Using Retexture API on rigged model: ${riggedModelUrl}`);
          console.log(`[MeshyProvider] 🎨 Flow: Mesh → Rig → Textures (correct order)`);
          const retextureResult = await this.retextureModel(riggedModelUrl, description);
          
          if (retextureResult.modelUrl && retextureResult.modelUrl !== riggedModelUrl) {
            texturedModelUrl = retextureResult.modelUrl; // Use retextured rigged model
            riggedModelUrl = texturedModelUrl; // Update rigged model URL to include textures
            refineSucceeded = true; // Mark as succeeded since we have textures now
            console.log(`[MeshyProvider] ✅ Textures added to rigged model successfully`);
            console.log(`[MeshyProvider] ✅ Final model has: Mesh + Rig + Textures (colors)`);
            console.log(`[MeshyProvider] ✅ This is the correct order: Mesh → Rig → Textures`);
          } else {
            console.warn(`[MeshyProvider] ⚠️ Retexture returned same URL or empty - textures may not have been applied`);
            console.warn(`[MeshyProvider] ⚠️ Using rigged model without textures (will appear black/white)`);
          }
        } catch (error: any) {
          console.error(`[MeshyProvider] ❌ Retexture FAILED: ${error.message}`);
          console.error(`[MeshyProvider] ❌ Error details:`, error);
          console.warn(`[MeshyProvider] ⚠️ Using rigged model without textures (will appear black/white)`);
          // Continue with rigged model without textures - animations will work but no colors
        }
      }

      // Step 7: Collect and generate animations (Option A pattern)
      // For Option A: Collect basic animations from rigging + generate custom animations
      // See: docs/MESHY_COLOR_AND_ANIMATION_FLOW.md
      let animatedModelUrl = riggedModelUrl;
      let animationUrls: string[] = [];
      
      // Step 7a: Collect basic animations from rigging response (walking/running - "free")
      // These are armature-only GLBs (lightweight, perfect for Option A)
      // See: docs/MESHY_COLOR_AND_ANIMATION_FLOW.md
      if (rigResult && rigResult.basicAnimations) {
        // Prefer armature-only GLBs for Option A (lightweight, animation-only)
        const armatureAnimations: string[] = [];
        if (rigResult.basicAnimations.walking_armature_glb_url) {
          armatureAnimations.push(rigResult.basicAnimations.walking_armature_glb_url);
          console.log(`[MeshyProvider] ✅ Added walking_armature_glb_url (Option A - lightweight)`);
        }
        if (rigResult.basicAnimations.running_armature_glb_url) {
          armatureAnimations.push(rigResult.basicAnimations.running_armature_glb_url);
          console.log(`[MeshyProvider] ✅ Added running_armature_glb_url (Option A - lightweight)`);
        }
        
        // Fallback to withSkin GLBs if armature not available (heavier but works)
        if (armatureAnimations.length === 0) {
          if (rigResult.basicAnimations.walking_glb_url) {
            armatureAnimations.push(rigResult.basicAnimations.walking_glb_url);
            console.log(`[MeshyProvider] ⚠️ Using walking_glb_url (withSkin, heavier but works)`);
          }
          if (rigResult.basicAnimations.running_glb_url) {
            armatureAnimations.push(rigResult.basicAnimations.running_glb_url);
            console.log(`[MeshyProvider] ⚠️ Using running_glb_url (withSkin, heavier but works)`);
          }
        }
        
        if (armatureAnimations.length > 0) {
          animationUrls.push(...armatureAnimations);
          console.log(`[MeshyProvider] ✅ Collected ${armatureAnimations.length} basic animations from rigging (Option A)`);
        } else {
          console.log(`[MeshyProvider] ⚠️ No basic animations available in rigging response`);
        }
      }
      
      // Step 7b: Generate custom animations (idle, thinking, wave, etc.)
      if (rigTaskId) {
        try {
          console.log(`[MeshyProvider] Generating custom animations...`);
          console.log(`[MeshyProvider] Generating minimal animation set for mobile AR (idle, thinking, wave)`);
          
          // Generate multiple animations (each returns separate GLB)
          // Recommended minimal set: Idle (0), Thinking (36), Wave (28)
          const animationSet = [
            { name: 'idle', action_id: 0 }, // Idle
            { name: 'thinking', action_id: 36 }, // Confused_Scratch
            { name: 'wave', action_id: 28 }, // Big_Wave_Hello
          ];
          
          const animationResults = await this.addMultipleAnimations(rigTaskId, animationSet);
          const customAnimationUrls = animationResults.map(r => r.url).filter(Boolean);
          animationUrls.push(...customAnimationUrls);
          
          // IMPORTANT: Keep rigged base character URL as modelUrl
          // Animations are separate GLBs that should be loaded as clips in the engine
          // The rigged base character is what you'll use, with animation clips applied to it
          // See: docs/MESHY_COLOR_AND_ANIMATION_FLOW.md for Option A pattern
          animatedModelUrl = riggedModelUrl; // Use rigged base, not animation URL
          
          console.log(`[MeshyProvider] ✅ Custom animations added: ${customAnimationUrls.length} animations`);
          console.log(`[MeshyProvider] ✅ Total animations (basic + custom): ${animationUrls.length}`);
          console.log(`[MeshyProvider] ✅ Rigged base character: ${riggedModelUrl}`);
          console.log(`[MeshyProvider] ✅ All animation URLs:`, animationUrls);
          console.log(`[MeshyProvider] ✅ Option A pattern: Load base character ONCE, then load animation clips separately`);
        } catch (error: any) {
          console.warn(`[MeshyProvider] Custom animation generation failed: ${error.message}`);
          console.warn(`[MeshyProvider] Using basic animations only (if available).`);
          // Continue with basic animations only
        }
      }

      // IMPORTANT: Return the best available model URL
      // Priority: Rigged+Textured > Textured > Remeshed > Preview
      // CRITICAL: Ensure we return the model with textures (colors) if refine succeeded
      const finalModelUrl = animatedModelUrl;
      
      console.log(`[MeshyProvider] 📊 ========== FINAL MODEL SUMMARY ==========`);
      console.log(`[MeshyProvider] 📊 Model URL breakdown:`);
      console.log(`[MeshyProvider]    - Preview (geometry only): ${previewModelUrl}`);
      console.log(`[MeshyProvider]    - Rigged (with bones): ${riggedModelUrl}`);
      console.log(`[MeshyProvider]    - Textured (with colors): ${texturedModelUrl}`);
      console.log(`[MeshyProvider]    - Final (to upload): ${finalModelUrl}`);
      console.log(`[MeshyProvider] 📊 Flow: Mesh (Preview) → Rig → Texture (Retexture)`);
      console.log(`[MeshyProvider] 📊 =========================================`);
      
      // Determine what features the final model has
      // Check if textures were actually applied (refine succeeded and URL changed)
      const hasTextures = refineSucceeded && texturedModelUrl !== previewModelUrl;
      const hasRigging = riggingSucceeded && riggedModelUrl !== texturedModelUrl && riggedModelUrl !== previewModelUrl;
      const hasAnimations = animationUrls.length > 0;
      
      console.log(`[MeshyProvider] ✅ Model features status:`);
      console.log(`[MeshyProvider]    - Textures/Colors: ${hasTextures ? '✅ YES (refine succeeded)' : '❌ NO (refine failed or not applied)'}`);
      console.log(`[MeshyProvider]    - Rigging: ${hasRigging ? '✅ YES (rigging succeeded)' : '❌ NO (rigging failed or not applied)'}`);
      console.log(`[MeshyProvider]    - Animations: ${hasAnimations ? '✅ YES' : '❌ NO (rigging required)'}`);
      
      // CRITICAL WARNINGS
      if (!hasTextures) {
        console.error(`[MeshyProvider] ❌❌❌ CRITICAL WARNING: Model has NO TEXTURES/COLORS ❌❌❌`);
        console.error(`[MeshyProvider] ❌ Model will appear BLACK/WHITE without colors`);
        console.error(`[MeshyProvider] ❌ Refine status: ${refineSucceeded ? 'SUCCEEDED but URL unchanged' : 'FAILED'}`);
        console.error(`[MeshyProvider] ❌ This usually means:`);
        console.error(`[MeshyProvider]    1. Refine API requires a paid Meshy plan`);
        console.error(`[MeshyProvider]    2. API key has insufficient permissions`);
        console.error(`[MeshyProvider]    3. Refine API endpoint is not available for this account`);
        console.error(`[MeshyProvider] ❌ Final model URL being uploaded: ${finalModelUrl}`);
      } else {
        console.log(`[MeshyProvider] ✅ Model HAS textures/colors - should display correctly`);
      }
      
      if (!hasRigging) {
        console.warn(`[MeshyProvider] ⚠️ WARNING: Model has NO rigging. Animations will not work.`);
        console.warn(`[MeshyProvider] ⚠️ This usually means Rigging API requires a paid Meshy plan.`);
      }
      
      // SOLUTION: Use rigged model if both refine and rigging succeeded
      // According to Meshy docs and research, rigging preserves textures from input model
      // We also passed texture_image_url to rigging API to ensure texture preservation
      // The rigged model has BOTH rigging (for animations) AND textures (for colors)
      // 
      // This follows Option A pattern (Three.js React Native):
      // - Base character: rigged_character_glb_url (ONE heavy file with mesh + textures + skeleton)
      // - Animation assets: separate lightweight files (armature GLBs or converted FBX→GLB clips)
      // See: docs/MESHY_COLOR_AND_ANIMATION_FLOW.md for complete flow
      let modelUrlToReturn = finalModelUrl;
      if (refineSucceeded && riggingSucceeded) {
        // BEST CASE: Both succeeded - rigged model should have textures (we passed texture_url)
        // Use rigged model - it has BOTH animations AND colors
        // This is the BASE CHARACTER for Option A pattern
        modelUrlToReturn = riggedModelUrl;
        console.log(`[MeshyProvider] ✅✅✅ BEST: Using RIGGED model (has BOTH animations AND colors): ${modelUrlToReturn}`);
        console.log(`[MeshyProvider] ✅ We passed texture_image_url to rigging API, so textures should be preserved`);
        console.log(`[MeshyProvider] ✅ This model has: Rigging (animations) + Textures (colors)`);
        console.log(`[MeshyProvider] ✅ This is the BASE CHARACTER for Option A pattern (Three.js React Native)`);
        console.log(`[MeshyProvider] ✅ Load this ONCE, then load animation clips separately`);
        console.log(`[MeshyProvider] ✅ Client should use this modelUrl as base character`);
        console.log(`[MeshyProvider] ✅ Client should use animationUrls array for separate animation clips`);
      } else if (refineSucceeded && !riggingSucceeded) {
        // Refine succeeded but rigging failed - use textured model (has colors, no animations)
        modelUrlToReturn = texturedModelUrl;
        console.log(`[MeshyProvider] ✅ Using TEXTURED model (has colors, but NO animations): ${modelUrlToReturn}`);
        console.warn(`[MeshyProvider] ⚠️ Rigging failed - animations will not work`);
      } else if (!refineSucceeded && riggingSucceeded) {
        // Refine failed but rigging succeeded - use rigged model (has animations, may not have colors)
        modelUrlToReturn = riggedModelUrl;
        console.warn(`[MeshyProvider] ⚠️ Using RIGGED model (has animations, but may NOT have colors): ${modelUrlToReturn}`);
        console.warn(`[MeshyProvider] ⚠️ Refine failed - model may appear black/white`);
      } else {
        // Both failed - use whatever we have
        modelUrlToReturn = finalModelUrl;
        console.error(`[MeshyProvider] ❌ Both refine and rigging failed - returning untextured/unrigged model: ${modelUrlToReturn}`);
      }
      
      return {
        modelId: `meshy_${taskId}`,
        modelUrl: modelUrlToReturn, // Ensure we return the model with textures if available
        animationUrls: animationUrls.length > 0 ? animationUrls : undefined, // Separate animation GLB URLs
        format: AvatarModelFormat.GLB,
        metadata: {
          polygonCount: previewResult?.polygonCount || 9000, // Target: 9k for mobile (remeshed)
          textureResolution: hasTextures ? 1024 : 0, // Base color only (enable_pbr: false in retexture)
          boneCount: hasRigging ? 60 : 0, // Standard humanoid rig
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
    
    // Enhance prompt for rigging compatibility and facial details
    const enhancedPrompt = `${prompt}, humanoid character in T-pose, clear facial features, expressive eyes, simple geometry, game-ready, mobile-optimized`;
    const negativePrompt = 'blurry, low quality, distorted, deformed, complex pose, high poly, detailed geometry, featureless face';
    
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
      requestBody.target_polycount = 9000; // Sweet spot for mobile AR characters (100-300,000 valid range)
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
   * CRITICAL: Pass texture_image_url to ensure textures are preserved during rigging
   * 
   * Response includes:
   * - rigged_character_glb_url: Base rigged character
   * - basic_animations: Optional walking/running animations
   */
  private async createRigTask(modelUrl: string, textureUrl?: string): Promise<string> {
    const requestBody: any = {
      model_url: modelUrl,
      rig_preset: 'STANDARD_HUMANOID', // Explicit preset for humanoid characters
      height_meters: 1.75, // Character height in meters - strongly recommended for better skeleton scaling
    };
    
    // CRITICAL: Pass texture URL to rigging API to ensure textures are preserved
    // According to Meshy docs, texture_image_url is optional but helps preserve textures
    // NOTE: In GLB format, textures are typically EMBEDDED in the binary file
    // The texture_image_url parameter is optional - textures should be in the GLB itself
    if (textureUrl) {
      requestBody.texture_image_url = textureUrl;
      console.log(`[MeshyProvider] 🦴 Passing texture URL to rigging API: ${textureUrl}`);
      console.log(`[MeshyProvider] 🦴 This should help preserve textures during rigging`);
    } else {
      console.log(`[MeshyProvider] 🦴 No separate texture URL - textures should be EMBEDDED in GLB file`);
      console.log(`[MeshyProvider] 🦴 Rigging should preserve textures from the input GLB automatically`);
      console.log(`[MeshyProvider] 🦴 If textures are missing, the GLB might not have textures embedded`);
    }
    
    const response = await axios.post(
      `${this.baseUrl}/openapi/v1/rigging`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

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
          // See: docs/MESHY_RIGGING_ANIMATION.md and docs/MESHY_COLOR_AND_ANIMATION_FLOW.md
          const result = response.data.result || response.data;
          
          // Extract rigged character URL (base character with textures + skeleton)
          const riggedModelUrl = result.rigged_character_glb_url ||
                                 result.rigged_character_fbx_url ||
                                 result.model_urls?.glb || 
                                 result.model_urls?.gltf || 
                                 result.model_url || 
                                 result.url || '';
          
          // Extract basic animations (walking/running) - these are "free" with rigging
          // Prefer armature-only GLBs for Option A (lightweight, separate animation assets)
          const basicAnimations = result.basic_animations || null;
          
          if (basicAnimations) {
            console.log(`[MeshyProvider] ✅ Basic animations from rigging:`);
            console.log(`[MeshyProvider]    - Walking armature: ${basicAnimations.walking_armature_glb_url || 'NOT AVAILABLE'}`);
            console.log(`[MeshyProvider]    - Running armature: ${basicAnimations.running_armature_glb_url || 'NOT AVAILABLE'}`);
            console.log(`[MeshyProvider]    - Walking withSkin: ${basicAnimations.walking_glb_url || 'NOT AVAILABLE'}`);
            console.log(`[MeshyProvider]    - Running withSkin: ${basicAnimations.running_glb_url || 'NOT AVAILABLE'}`);
            console.log(`[MeshyProvider] ✅ For Option A (Three.js), prefer *_armature_glb_url (lightweight)`);
          }
          
          return {
            modelUrl: riggedModelUrl,
            basicAnimations: basicAnimations,
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
   * - texture_prompt: optional texturing prompt with color guidance
   * - texture_image_url: optional reference image
   * 
   * Color pipeline: Base-color textures only (no PBR)
   * - Colors stored in one BaseColor texture
   * - No normal/roughness/metallic maps
   * - Lighting from engine, not textures
   */
  private async createRefineTask(previewTaskId: string, description: CharacterDescription): Promise<string> {
    // Build base prompt from character description (includes hair color, eye color, clothing)
    const basePrompt = this.buildPrompt(description);
    
    // Extract color information from description for texture prompt
    const skinColor = 'natural skin tone'; // CharacterDescription doesn't have skinColor, use default
    const hairColor = description.hair?.color || 'natural hair color';
    const eyeColor = description.eyes?.color || 'clear eyes';
    const clothingColor = description.clothing || 'simple fabric colors';
    
    // Build comprehensive texture prompt using recommended template
    // This ensures colors for clothes, skin, hair, eyes while staying lightweight
    const texturePrompt = `semi-realistic character,
${skinColor} with smooth shading,
clear eyes with visible iris and sclera, ${eyeColor},
defined lips with subtle color,
${hairColor} hair,
${clothingColor} for clothing,
separate materials for skin, hair, eyes, and clothing,
matte surfaces,
simple fabric colors,
no skin pores,
no freckles,
no wrinkles,
no tiny patterns,
no logos,
mobile-game style textures,
flat base colors with gentle shading,
no baked lighting,
no dramatic shadows,
no strong highlights,
optimized for mobile AR`;
    
    const requestBody: any = {
      mode: 'refine', // Refine stage: adds textures to preview geometry
      preview_task_id: previewTaskId,
      // Lightweight texture settings
      enable_pbr: false, // Base color only (lighter & faster for mobile) - CRITICAL for colors
      // Optional: texture_prompt for custom texturing with color guidance
      texture_prompt: texturePrompt,
    };
    
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
   * Returns textured model URL and texture URL (for rigging API)
   * See: docs/MESHY_COLOR_AND_ANIMATION_FLOW.md
   */
  private async pollRefineTask(
    taskId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<{ modelUrl: string; textureUrl?: string }> {
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
          // Refine stage returns textured model with texture URLs
          const result = response.data.result || response.data;
          
          // Log full response structure for debugging
          console.log(`[MeshyProvider] 🎨 Refine API response structure:`, JSON.stringify({
            hasResult: !!result,
            hasModelUrls: !!result.model_urls,
            hasTextures: !!result.textures,
            textureKeys: result.textures ? Object.keys(result.textures) : [],
            allKeys: Object.keys(result || {}),
          }, null, 2));
          
          const modelUrl = result.model_urls?.glb || 
                          result.model_urls?.gltf || 
                          result.model_url || 
                          result.url || '';
          
          // Extract base_color texture URL from textures array (if available)
          // NOTE: In GLB format, textures are usually EMBEDDED in the binary file
          // The texture URL here is optional - textures should be in the GLB itself
          let textureUrl: string | undefined;
          
          // Check multiple possible response structures
          if (result.textures) {
            if (Array.isArray(result.textures) && result.textures.length > 0) {
              // Find base_color texture
              const baseColorTexture = result.textures.find((t: any) => t.base_color || t.type === 'base_color');
              if (baseColorTexture) {
                textureUrl = baseColorTexture.base_color || baseColorTexture.url;
                console.log(`[MeshyProvider] 🎨 Found base_color texture URL from refine array: ${textureUrl}`);
              } else {
                // Use first texture if no base_color found
                textureUrl = result.textures[0].url || result.textures[0].base_color;
                console.log(`[MeshyProvider] 🎨 Using first texture URL from refine array: ${textureUrl}`);
              }
            } else if (typeof result.textures === 'object') {
              // Textures might be an object with base_color property
              textureUrl = result.textures.base_color || result.textures.url || result.textures.base_color_url;
              if (textureUrl) {
                console.log(`[MeshyProvider] 🎨 Found texture URL from refine object: ${textureUrl}`);
              }
            }
          }
          
          // Also check for texture_urls or texture_urls.base_color
          if (!textureUrl && result.texture_urls) {
            textureUrl = result.texture_urls.base_color || result.texture_urls.url || result.texture_urls[0];
            if (textureUrl) {
              console.log(`[MeshyProvider] 🎨 Found texture URL from texture_urls: ${textureUrl}`);
            }
          }
          
          console.log(`[MeshyProvider] 🎨 Refine task ${taskId} completed successfully`);
          console.log(`[MeshyProvider] 🎨 Model URL: ${modelUrl}`);
          console.log(`[MeshyProvider] 🎨 Texture URL: ${textureUrl || 'NOT FOUND (textures should be EMBEDDED in GLB file)'}`);
          console.log(`[MeshyProvider] 🎨 IMPORTANT: In GLB format, textures are typically EMBEDDED in the binary file`);
          console.log(`[MeshyProvider] 🎨 The GLB file itself should contain textures - no separate URL needed`);
          
          if (!modelUrl || modelUrl.trim() === '') {
            throw new Error('Refine completed but no model URL in response');
          }
          
          return { modelUrl, textureUrl };
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
   * Remesh model from URL (for remeshing preview geometry before texturing)
   * Documentation: https://docs.meshy.ai/api/remesh
   * For lightweight models: @see docs/MESHY_LIGHTWEIGHT_MODELS.md
   */
  private async remeshModelFromUrl(modelUrl: string): Promise<{ modelUrl: string }> {
    const response = await axios.post(
      `${this.baseUrl}/openapi/v1/remesh`,
      {
        model_url: modelUrl, // Use model URL directly
        target_formats: ['glb'],
        topology: 'triangle', // Best for mobile
        target_polycount: 9000, // Sweet spot for mobile AR characters
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
   * Remesh model from task ID (legacy method, kept for backward compatibility)
   * Documentation: https://docs.meshy.ai/api/remesh
   */
  private async remeshModel(inputTaskId: string): Promise<{ modelUrl: string }> {
    const response = await axios.post(
      `${this.baseUrl}/openapi/v1/remesh`,
      {
        input_task_id: inputTaskId, // Use task ID instead of model URL
        target_formats: ['glb'],
        topology: 'triangle', // Best for mobile
        target_polycount: 9000, // Sweet spot for mobile AR characters
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

  /**
   * Retexture a model (add textures to any model URL, including remeshed models)
   * This is used after remeshing to add textures to optimized geometry
   * Documentation: https://docs.meshy.ai/api/retexture
   * 
   * Parameters:
   * - model_url: URL of the model to texture (can be remeshed model)
   * - text_style_prompt: Description of desired texture style with color guidance
   * - enable_pbr: false for lightweight (base color only, no PBR maps)
   * 
   * Color pipeline: Base-color textures only (no PBR)
   * - Colors stored in one BaseColor texture
   * - No normal/roughness/metallic maps
   * - Lighting from engine, not textures
   * - Separate materials for skin, hair, eyes, clothing (for runtime color swapping)
   * 
   * Returns both model URL and texture URL (for passing to rigging API)
   */
  private async retextureModel(modelUrl: string, description: CharacterDescription): Promise<{ modelUrl: string; textureUrl?: string }> {
    // Build base prompt from character description (includes hair color, eye color, clothing)
    const basePrompt = this.buildPrompt(description);
    
    // Extract color information from description for texture prompt
    const skinColor = 'natural skin tone'; // CharacterDescription doesn't have skinColor, use default
    const hairColor = description.hair?.color || 'natural hair color';
    const eyeColor = description.eyes?.color || 'clear eyes';
    const clothingColor = description.clothing || 'simple fabric colors';
    
    // Build comprehensive texture prompt using recommended template
    // This ensures colors for clothes, skin, hair, eyes while staying lightweight
    // Template: semi-realistic, natural colors, clear features, no heavy details
    const texturePrompt = `semi-realistic character,
${skinColor} with smooth shading,
clear eyes with visible iris and sclera, ${eyeColor},
defined lips with subtle color,
${hairColor} hair,
${clothingColor} for clothing,
separate materials for skin, hair, eyes, and clothing,
matte surfaces,
simple fabric colors,
no skin pores,
no freckles,
no wrinkles,
no tiny patterns,
no logos,
mobile-game style textures,
flat base colors with gentle shading,
no baked lighting,
no dramatic shadows,
no strong highlights,
optimized for mobile AR`;
    
    const requestBody = {
      model_url: modelUrl, // Can be remeshed model URL
      text_style_prompt: texturePrompt,
      enable_pbr: false, // Base color only (lighter & faster for mobile) - CRITICAL for colors
    };
    
    console.log(`[MeshyProvider] 🎨 Retexture request details:`);
    console.log(`[MeshyProvider] 🎨   - Model URL: ${modelUrl}`);
    console.log(`[MeshyProvider] 🎨   - Enable PBR: false (base color only)`);
    console.log(`[MeshyProvider] 🎨   - Texture prompt length: ${texturePrompt.length} chars`);
    console.log(`[MeshyProvider] 🎨   - Texture prompt preview: ${texturePrompt.substring(0, 200)}...`);
    
    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}/openapi/v1/retexture`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      console.log(`[MeshyProvider] 🎨 Retexture API response status: ${response.status}`);
      console.log(`[MeshyProvider] 🎨 Retexture API response data:`, JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      // Handle HTTP errors (402, 403, 404, etc.)
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const errorData = error.response.data;
        
        console.error(`[MeshyProvider] ❌ Retexture API HTTP error: ${status} ${statusText}`);
        console.error(`[MeshyProvider] ❌ Error response:`, JSON.stringify(errorData, null, 2));
        
        if (status === 402) {
          throw new Error(`Payment Required (402): Retexture API requires a paid Meshy plan. Error: ${JSON.stringify(errorData)}`);
        } else if (status === 403) {
          throw new Error(`Forbidden (403): API key does not have permission to use Retexture API. Error: ${JSON.stringify(errorData)}`);
        } else if (status === 404) {
          throw new Error(`Not Found (404): Retexture API endpoint not found. Error: ${JSON.stringify(errorData)}`);
        } else {
          throw new Error(`HTTP ${status} ${statusText}: ${JSON.stringify(errorData)}`);
        }
      }
      throw error;
    }

    // Check for error in response
    if (response.data.error) {
      const errorMsg = `Meshy retexture API error: ${response.data.error.message || response.data.error}`;
      console.error(`[MeshyProvider] ❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (!response.data || !response.data.result) {
      console.error('[MeshyProvider] ❌ Invalid retexture response:', JSON.stringify(response.data, null, 2));
      throw new Error('Invalid response from Meshy retexture API - no result field');
    }

    const retextureTaskId = response.data.result;
    console.log(`[MeshyProvider] 🎨 Retexture task ID: ${retextureTaskId}`);
    
    // Poll for retexture task completion
    return await this.pollRetextureTask(retextureTaskId);
  }

  /**
   * Poll for retexture task completion
   * API Endpoint: GET /openapi/v1/retexture/{id}
   * 
   * Returns both model URL and base_color texture URL (for passing to rigging API)
   */
  private async pollRetextureTask(
    taskId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<{ modelUrl: string; textureUrl?: string }> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/openapi/v1/retexture/${taskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
            timeout: 30000, // Increased timeout for retexture
          }
        );

        const status = response.data.status || response.data.progress?.status;
        
        if (status === 'SUCCEEDED' || status === 'COMPLETED') {
          // Retexture response structure: result.model_urls or result.url
          const result = response.data.result || response.data;
          const modelUrl = result.model_urls?.glb || 
                          result.model_urls?.gltf || 
                          result.model_url || 
                          result.url || '';
          
          // Extract base_color texture URL from textures array (if available)
          // This is needed to pass to rigging API to preserve textures
          let textureUrl: string | undefined;
          if (result.textures && Array.isArray(result.textures) && result.textures.length > 0) {
            // Find base_color texture
            const baseColorTexture = result.textures.find((t: any) => t.base_color || t.type === 'base_color');
            if (baseColorTexture) {
              textureUrl = baseColorTexture.base_color || baseColorTexture.url;
              console.log(`[MeshyProvider] 🎨 Found base_color texture URL: ${textureUrl}`);
            } else {
              // Use first texture if no base_color found
              textureUrl = result.textures[0].url || result.textures[0].base_color;
              console.log(`[MeshyProvider] 🎨 Using first texture URL: ${textureUrl}`);
            }
          }
          
          console.log(`[MeshyProvider] 🎨 Retexture task ${taskId} completed successfully`);
          console.log(`[MeshyProvider] 🎨 Response structure:`, JSON.stringify(result, null, 2));
          console.log(`[MeshyProvider] 🎨 Extracted model URL: ${modelUrl}`);
          console.log(`[MeshyProvider] 🎨 Extracted texture URL: ${textureUrl || 'NOT FOUND (will try to preserve from model)'}`);
          
          if (!modelUrl || modelUrl.trim() === '') {
            throw new Error('Retexture completed but no model URL in response');
          }
          
          return { modelUrl, textureUrl };
        } else if (status === 'FAILED' || status === 'ERROR') {
          const errorMsg = response.data.error || response.data.message || 'Unknown error';
          console.error(`[MeshyProvider] ❌ Retexture task ${taskId} failed: ${errorMsg}`);
          console.error(`[MeshyProvider] ❌ Full response:`, JSON.stringify(response.data, null, 2));
          throw new Error(`Meshy retexture task failed: ${errorMsg}`);
        } else {
          const progress = response.data.progress?.percentage || 
                          response.data.progress || 
                          response.data.percentage || 
                          0;
          console.log(`[MeshyProvider] Retexture task ${taskId} progress: ${progress}%`);
          
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
          throw new Error(`Meshy retexture task ${taskId} polling timed out after ${maxAttempts} attempts`);
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

    throw new Error(`Meshy retexture task ${taskId} timed out after ${maxAttempts} attempts`);
  }
}

