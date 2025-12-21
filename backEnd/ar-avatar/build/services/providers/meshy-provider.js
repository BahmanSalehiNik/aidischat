"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeshyProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const base_provider_1 = require("./base-provider");
const avatar_1 = require("../../models/avatar");
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
class MeshyProvider extends base_provider_1.BaseModelProvider {
    constructor(apiKey) {
        super(apiKey, 'https://api.meshy.ai');
    }
    getName() {
        return 'meshy';
    }
    generateModel(description, agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.log('[MeshyProvider] Starting lightweight model generation for mobile...');
            if (!this.isAvailable()) {
                throw new Error('Meshy API key is not configured');
            }
            try {
                // Build prompt from character description
                const prompt = this.buildPrompt(description);
                // Step 1: Create a text-to-3D preview task (geometry generation)
                // Using lightweight parameters for mobile optimization
                const taskId = yield this.createTask(prompt, description);
                console.log(`[MeshyProvider] Preview task created: ${taskId}`);
                // Step 2: Poll for preview completion (geometry only, no texture yet)
                const previewResult = yield this.pollTask(taskId);
                console.log(`[MeshyProvider] Preview completed: ${taskId}`);
                // Step 3: Refine the model (add textures)
                // This is the second stage of text-to-3d workflow
                // For lightweight models: @see docs/MESHY_LIGHTWEIGHT_MODELS.md
                let refinedModelUrl = previewResult.modelUrl || previewResult.glbUrl || previewResult.url;
                let refineTaskId = null;
                let refineResult = null;
                try {
                    console.log(`[MeshyProvider] Starting texture refinement...`);
                    refineTaskId = yield this.createRefineTask(taskId, description);
                    console.log(`[MeshyProvider] Refine task created: ${refineTaskId}`);
                    refineResult = yield this.pollRefineTask(refineTaskId);
                    refinedModelUrl = refineResult.modelUrl || refinedModelUrl;
                    console.log(`[MeshyProvider] Refinement completed: ${refineTaskId}`);
                }
                catch (error) {
                    console.warn(`[MeshyProvider] Texture refinement failed: ${error.message}. Using preview model without textures.`);
                    // Continue with untextured preview model
                }
                // Step 4: Optional remesh pass for final lightweight optimization
                let finalModelUrl = refinedModelUrl;
                try {
                    console.log(`[MeshyProvider] Starting remesh pass for final optimization...`);
                    const remeshResult = yield this.remeshModel(refinedModelUrl);
                    finalModelUrl = remeshResult.modelUrl || refinedModelUrl;
                    console.log(`[MeshyProvider] Remesh completed - final model optimized for mobile`);
                }
                catch (error) {
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
                // Use Meshy's URL directly - it's already publicly accessible
                let riggedModelUrl = modelUrl;
                let rigTaskId = null;
                try {
                    console.log(`[MeshyProvider] Starting auto-rigging for model...`);
                    console.log(`[MeshyProvider] Model URL: ${modelUrl}`);
                    rigTaskId = yield this.createRigTask(modelUrl);
                    console.log(`[MeshyProvider] Rig task created: ${rigTaskId}`);
                    const rigResult = yield this.pollRigTask(rigTaskId);
                    riggedModelUrl = rigResult.modelUrl || modelUrl;
                    console.log(`[MeshyProvider] Rigging completed: ${rigTaskId}`);
                    console.log(`[MeshyProvider] Rigged model URL: ${riggedModelUrl}`);
                    // Check if basic animations were included in rigging response
                    if (rigResult.basicAnimations) {
                        console.log(`[MeshyProvider] Basic animations included in rigging response (walking/running)`);
                        // These can be used as fallback if custom animations fail
                    }
                }
                catch (error) {
                    console.warn(`[MeshyProvider] Auto-rigging failed: ${error.message}`);
                    console.warn(`[MeshyProvider] Possible causes: model not humanoid, unclear body structure, or not in T-pose`);
                    console.warn(`[MeshyProvider] Using unrigged model. Animations will not work.`);
                    // Continue with unrigged model - animations won't work but model will still load
                }
                // Step 7: Add animations to the rigged model
                // For lightweight mobile AR: Generate minimal set (idle, thinking, walk)
                // See: docs/MESHY_RIGGING_ANIMATION.md
                let animatedModelUrl = riggedModelUrl;
                let animationUrls = [];
                if (rigTaskId) {
                    try {
                        console.log(`[MeshyProvider] Adding animations to rigged model...`);
                        console.log(`[MeshyProvider] Generating minimal animation set for mobile AR (idle, thinking, walk)`);
                        // Generate multiple animations (each returns separate GLB)
                        // Recommended minimal set: Idle (0), Thinking/Gesture (25), Walk (1)
                        const animationSet = [
                            { name: 'idle', action_id: 0 },
                            { name: 'thinking', action_id: 25 }, // Agree_Gesture or similar
                            { name: 'walk', action_id: 1 }, // Walking_Woman
                        ];
                        const animationResults = yield this.addMultipleAnimations(rigTaskId, animationSet);
                        animationUrls = animationResults.map(r => r.url).filter(Boolean);
                        // Use first animation as "default" (or keep rigged base)
                        // In practice, you'll load rigged base + animation clips separately
                        animatedModelUrl = ((_a = animationResults[0]) === null || _a === void 0 ? void 0 : _a.url) || riggedModelUrl;
                        console.log(`[MeshyProvider] Animations added: ${animationUrls.length} animations`);
                        console.log(`[MeshyProvider] Animation URLs:`, animationUrls);
                        console.log(`[MeshyProvider] Note: Each animation is a separate GLB - load rigged base + clips in engine`);
                    }
                    catch (error) {
                        console.warn(`[MeshyProvider] Animation addition failed: ${error.message}`);
                        console.warn(`[MeshyProvider] Using rigged model without animations.`);
                        // Continue with rigged but unanimated model
                    }
                }
                return {
                    modelId: `meshy_${taskId}`,
                    modelUrl: animatedModelUrl, // Use animated model if available, otherwise rigged, otherwise original
                    format: avatar_1.AvatarModelFormat.GLB,
                    metadata: {
                        polygonCount: (previewResult === null || previewResult === void 0 ? void 0 : previewResult.polygonCount) || (refineResult === null || refineResult === void 0 ? void 0 : refineResult.polygonCount) || 10000, // Target: 6k-15k for mobile
                        textureResolution: (refineResult === null || refineResult === void 0 ? void 0 : refineResult.textureResolution) || 1024, // Lower for mobile (base color only, enable_pbr: false)
                        boneCount: 60, // Standard humanoid rig
                        animationCount: animationUrls.length || 0,
                    },
                };
            }
            catch (error) {
                console.error('[MeshyProvider] Generation error:', error);
                throw new Error(`Meshy generation failed: ${error.message}`);
            }
        });
    }
    createTask(prompt, description) {
        return __awaiter(this, void 0, void 0, function* () {
            // Meshy API endpoint for text-to-3D Preview stage (geometry generation)
            // Documentation: https://docs.meshy.ai/api-reference/text-to-3d
            // For lightweight models guide: @see docs/MESHY_LIGHTWEIGHT_MODELS.md
            // 
            // Text-to-3D is two-stage: Preview (geometry) → Refine (texture)
            // This is Stage 1: Preview - generates geometry only (no textures yet)
            // Enhance prompt for rigging compatibility
            const enhancedPrompt = `${prompt}, humanoid character in T-pose, simple geometry, game-ready, mobile-optimized`;
            const negativePrompt = 'blurry, low quality, distorted, deformed, complex pose, high poly, detailed geometry';
            // Mobile-optimized parameters for lightweight models
            // target_polycount: 6k-15k for AR characters (using 10k as middle ground)
            // topology: "triangle" - best for mobile runtime
            // should_remesh: true - CRITICAL: must be true for target_polycount to work
            // pose_mode: "t-pose" - essential for humanoid rigging
            const response = yield axios_1.default.post(`${this.baseUrl}/v2/text-to-3d`, {
                prompt: enhancedPrompt,
                mode: 'preview', // Preview stage: generates geometry (no textures yet)
                art_style: this.mapToArtStyle(description.style),
                negative_prompt: negativePrompt,
                // Lightweight parameters - see docs/MESHY_LIGHTWEIGHT_MODELS.md
                target_polycount: 10000, // 6k-15k for mobile AR characters
                topology: 'triangle', // Best for mobile runtime
                should_remesh: true, // CRITICAL: Must be true for polycount to work
                pose_mode: 't-pose', // Essential for rigging
                symmetry_mode: 'x', // Optional: helps consistency
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            if (!response.data || !response.data.result) {
                throw new Error('Invalid response from Meshy API');
            }
            return response.data.result;
        });
    }
    mapToArtStyle(style) {
        // Map character style to Meshy art style
        // Note: Available art styles may vary by API plan
        // Common values: realistic, cartoon, low-poly, sculpture, pbr
        // For this account, only realistic and sculpture are available
        const styleMap = {
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
    pollTask(taskId_1) {
        return __awaiter(this, arguments, void 0, function* (taskId, maxAttempts = 60, intervalMs = 5000) {
            var _a, _b, _c, _d, _e;
            let attempts = 0;
            while (attempts < maxAttempts) {
                try {
                    const response = yield axios_1.default.get(`${this.baseUrl}/v2/text-to-3d/${taskId}`, {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                        },
                        timeout: 10000,
                    });
                    const status = response.data.status || ((_a = response.data.progress) === null || _a === void 0 ? void 0 : _a.status);
                    if (status === 'SUCCEEDED' || status === 'COMPLETED') {
                        // Task completed successfully
                        return {
                            modelUrl: ((_b = response.data.model_urls) === null || _b === void 0 ? void 0 : _b.glb) ||
                                ((_c = response.data.model_urls) === null || _c === void 0 ? void 0 : _c.gltf) ||
                                response.data.model_url ||
                                response.data.url,
                            polygonCount: response.data.polygon_count,
                            textureResolution: response.data.texture_resolution,
                            boneCount: response.data.bone_count,
                            animationCount: response.data.animation_count,
                        };
                    }
                    else if (status === 'FAILED' || status === 'ERROR') {
                        throw new Error(`Meshy task failed: ${response.data.error || response.data.message || 'Unknown error'}`);
                    }
                    else {
                        // Still processing
                        const progress = ((_d = response.data.progress) === null || _d === void 0 ? void 0 : _d.percentage) ||
                            response.data.progress ||
                            response.data.percentage ||
                            0;
                        console.log(`[MeshyProvider] Task ${taskId} progress: ${progress}%`);
                        attempts++;
                        if (attempts < maxAttempts) {
                            yield new Promise(resolve => setTimeout(resolve, intervalMs));
                        }
                    }
                }
                catch (error) {
                    if (((_e = error.response) === null || _e === void 0 ? void 0 : _e.status) === 404) {
                        // Task not found, might still be creating
                        attempts++;
                        if (attempts < maxAttempts) {
                            yield new Promise(resolve => setTimeout(resolve, intervalMs));
                            continue;
                        }
                    }
                    throw error;
                }
            }
            throw new Error(`Meshy task ${taskId} timed out after ${maxAttempts} attempts`);
        });
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
    createRigTask(modelUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield axios_1.default.post(`${this.baseUrl}/openapi/v1/rigging`, {
                model_url: modelUrl,
                rig_preset: 'STANDARD_HUMANOID', // Explicit preset for humanoid characters
                height_meters: 1.75, // Character height in meters - strongly recommended for better skeleton scaling
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
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
        });
    }
    /**
     * Poll for rigging task completion
     * API Endpoint: GET /openapi/v1/rigging/{id}
     * For rigging guide: @see docs/MESHY_RIGGING_ANIMATION.md
     */
    pollRigTask(taskId_1) {
        return __awaiter(this, arguments, void 0, function* (taskId, maxAttempts = 60, intervalMs = 5000) {
            var _a, _b, _c, _d, _e;
            let attempts = 0;
            while (attempts < maxAttempts) {
                try {
                    const response = yield axios_1.default.get(`${this.baseUrl}/openapi/v1/rigging/${taskId}`, {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                        },
                        timeout: 10000,
                    });
                    const status = response.data.status || ((_a = response.data.progress) === null || _a === void 0 ? void 0 : _a.status);
                    if (status === 'SUCCEEDED' || status === 'COMPLETED') {
                        // Rigging response structure: result.rigged_character_glb_url
                        // See: docs/MESHY_RIGGING_ANIMATION.md for response structure
                        const result = response.data.result || response.data;
                        return {
                            modelUrl: result.rigged_character_glb_url ||
                                result.rigged_character_fbx_url ||
                                ((_b = result.model_urls) === null || _b === void 0 ? void 0 : _b.glb) ||
                                ((_c = result.model_urls) === null || _c === void 0 ? void 0 : _c.gltf) ||
                                result.model_url ||
                                result.url || '',
                            // Basic animations may be included in rigging response (walking/running)
                            basicAnimations: result.basic_animations || null,
                        };
                    }
                    else if (status === 'FAILED' || status === 'ERROR') {
                        throw new Error(`Meshy rigging task failed: ${response.data.error || response.data.message || 'Unknown error'}`);
                    }
                    else {
                        const progress = ((_d = response.data.progress) === null || _d === void 0 ? void 0 : _d.percentage) ||
                            response.data.progress ||
                            response.data.percentage ||
                            0;
                        console.log(`[MeshyProvider] Rigging task ${taskId} progress: ${progress}%`);
                        attempts++;
                        if (attempts < maxAttempts) {
                            yield new Promise(resolve => setTimeout(resolve, intervalMs));
                        }
                    }
                }
                catch (error) {
                    if (((_e = error.response) === null || _e === void 0 ? void 0 : _e.status) === 404) {
                        attempts++;
                        if (attempts < maxAttempts) {
                            yield new Promise(resolve => setTimeout(resolve, intervalMs));
                            continue;
                        }
                    }
                    throw error;
                }
            }
            throw new Error(`Meshy rigging task ${taskId} timed out after ${maxAttempts} attempts`);
        });
    }
    /**
     * Add multiple animations to a rigged model
     * Documentation: https://docs.meshy.ai/en/api/rigging-and-animation
     * For animation guide: @see docs/MESHY_RIGGING_ANIMATION.md
     *
     * Each animation is generated separately and returns its own GLB.
     * You'll need to load the rigged base character + animation clips in your engine.
     */
    addMultipleAnimations(rigTaskId, animations) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            // Generate each animation separately
            for (const anim of animations) {
                try {
                    console.log(`[MeshyProvider] Generating ${anim.name} animation (action_id: ${anim.action_id})...`);
                    const response = yield axios_1.default.post(`${this.baseUrl}/openapi/v1/animations`, {
                        rig_task_id: rigTaskId,
                        action_id: anim.action_id,
                        post_process: {
                            operation_type: 'change_fps',
                            fps: 24, // 24 fps recommended for mobile AR (lighter than 30/60)
                        },
                    }, {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 30000,
                    });
                    // Response structure: { "result": "animation_task_id" }
                    const animTaskId = response.data.result || response.data.animation_task_id || response.data.id;
                    if (!animTaskId) {
                        throw new Error('Invalid response from Meshy animation API');
                    }
                    // Poll for animation completion
                    const animResult = yield this.pollAnimationTask(animTaskId);
                    results.push({
                        name: anim.name,
                        url: animResult.modelUrl || '',
                    });
                    console.log(`[MeshyProvider] ✅ ${anim.name} animation completed: ${animResult.modelUrl}`);
                }
                catch (error) {
                    console.warn(`[MeshyProvider] Failed to generate ${anim.name} animation: ${error.message}`);
                    // Continue with other animations
                }
            }
            return results;
        });
    }
    /**
     * Poll for animation task completion
     * API Endpoint: GET /openapi/v1/animations/{id}
     */
    pollAnimationTask(taskId_1) {
        return __awaiter(this, arguments, void 0, function* (taskId, maxAttempts = 60, intervalMs = 5000) {
            var _a, _b, _c, _d, _e;
            let attempts = 0;
            while (attempts < maxAttempts) {
                try {
                    const response = yield axios_1.default.get(`${this.baseUrl}/openapi/v1/animations/${taskId}`, {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                        },
                        timeout: 10000,
                    });
                    const status = response.data.status || ((_a = response.data.progress) === null || _a === void 0 ? void 0 : _a.status);
                    if (status === 'SUCCEEDED' || status === 'COMPLETED') {
                        // Animation response structure: result.animation_glb_url
                        const result = response.data.result || response.data;
                        return {
                            modelUrl: result.animation_glb_url ||
                                result.animation_fbx_url ||
                                ((_b = result.model_urls) === null || _b === void 0 ? void 0 : _b.glb) ||
                                ((_c = result.model_urls) === null || _c === void 0 ? void 0 : _c.gltf) ||
                                result.model_url ||
                                result.url || '',
                            animationUrls: result.animation_urls ||
                                result.animations ||
                                [],
                        };
                    }
                    else if (status === 'FAILED' || status === 'ERROR') {
                        throw new Error(`Meshy animation task failed: ${response.data.error || response.data.message || 'Unknown error'}`);
                    }
                    else {
                        const progress = ((_d = response.data.progress) === null || _d === void 0 ? void 0 : _d.percentage) ||
                            response.data.progress ||
                            response.data.percentage ||
                            0;
                        console.log(`[MeshyProvider] Animation task ${taskId} progress: ${progress}%`);
                        attempts++;
                        if (attempts < maxAttempts) {
                            yield new Promise(resolve => setTimeout(resolve, intervalMs));
                        }
                    }
                }
                catch (error) {
                    if (((_e = error.response) === null || _e === void 0 ? void 0 : _e.status) === 404) {
                        attempts++;
                        if (attempts < maxAttempts) {
                            yield new Promise(resolve => setTimeout(resolve, intervalMs));
                            continue;
                        }
                    }
                    throw error;
                }
            }
            throw new Error(`Meshy animation task ${taskId} timed out after ${maxAttempts} attempts`);
        });
    }
    /**
     * Create a refine task to add textures to the preview model
     * This is Stage 2 of text-to-3d workflow (Preview → Refine)
     * Documentation: https://docs.meshy.ai/api-reference/text-to-3d
     * For lightweight models: @see docs/MESHY_LIGHTWEIGHT_MODELS.md
     */
    createRefineTask(previewTaskId, description) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield axios_1.default.post(`${this.baseUrl}/v2/text-to-3d`, {
                mode: 'refine', // Refine stage: adds textures to preview geometry
                preview_task_id: previewTaskId,
                // Lightweight texture settings
                enable_pbr: false, // Base color only (lighter & faster for mobile)
                // Optional: texture_prompt or texture_image_url for custom texturing
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            if (!response.data || !response.data.result) {
                throw new Error('Invalid response from Meshy refine API');
            }
            return response.data.result;
        });
    }
    /**
     * Poll for refine task completion
     * Returns textured model URL
     */
    pollRefineTask(taskId_1) {
        return __awaiter(this, arguments, void 0, function* (taskId, maxAttempts = 60, intervalMs = 5000) {
            var _a, _b, _c, _d, _e;
            let attempts = 0;
            while (attempts < maxAttempts) {
                try {
                    const response = yield axios_1.default.get(`${this.baseUrl}/v2/text-to-3d/${taskId}`, {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                        },
                        timeout: 10000,
                    });
                    const status = response.data.status || ((_a = response.data.progress) === null || _a === void 0 ? void 0 : _a.status);
                    if (status === 'SUCCEEDED' || status === 'COMPLETED') {
                        // Refine stage returns textured model
                        return {
                            modelUrl: ((_b = response.data.model_urls) === null || _b === void 0 ? void 0 : _b.glb) ||
                                ((_c = response.data.model_urls) === null || _c === void 0 ? void 0 : _c.gltf) ||
                                response.data.model_url ||
                                response.data.url,
                            polygonCount: response.data.polygon_count,
                            textureResolution: response.data.texture_resolution,
                        };
                    }
                    else if (status === 'FAILED' || status === 'ERROR') {
                        throw new Error(`Meshy refine task failed: ${response.data.error || response.data.message || 'Unknown error'}`);
                    }
                    else {
                        const progress = ((_d = response.data.progress) === null || _d === void 0 ? void 0 : _d.percentage) ||
                            response.data.progress ||
                            response.data.percentage ||
                            0;
                        console.log(`[MeshyProvider] Refine task ${taskId} progress: ${progress}%`);
                        attempts++;
                        if (attempts < maxAttempts) {
                            yield new Promise(resolve => setTimeout(resolve, intervalMs));
                        }
                    }
                }
                catch (error) {
                    if (((_e = error.response) === null || _e === void 0 ? void 0 : _e.status) === 404) {
                        attempts++;
                        if (attempts < maxAttempts) {
                            yield new Promise(resolve => setTimeout(resolve, intervalMs));
                            continue;
                        }
                    }
                    throw error;
                }
            }
            throw new Error(`Meshy refine task ${taskId} timed out after ${maxAttempts} attempts`);
        });
    }
    /**
     * Remesh model for final lightweight optimization
     * This is an optional pass to further optimize the model for mobile
     * Documentation: https://docs.meshy.ai/api/remesh
     * For lightweight models: @see docs/MESHY_LIGHTWEIGHT_MODELS.md
     */
    remeshModel(modelUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield axios_1.default.post(`${this.baseUrl}/openapi/v1/remesh`, {
                model_url: modelUrl,
                target_formats: ['glb'],
                topology: 'triangle', // Best for mobile
                target_polycount: 10000, // Final target: 6k-15k for mobile AR characters
                resize_height: 1.75, // Character height in meters (nice for AR placement)
                origin_at: 'center', // Nice for AR placement
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            if (!response.data || !response.data.result) {
                throw new Error('Invalid response from Meshy remesh API');
            }
            const remeshTaskId = response.data.result;
            // Poll for remesh task completion
            return yield this.pollRemeshTask(remeshTaskId);
        });
    }
    /**
     * Poll for remesh task completion
     */
    pollRemeshTask(taskId_1) {
        return __awaiter(this, arguments, void 0, function* (taskId, maxAttempts = 60, intervalMs = 5000) {
            var _a, _b, _c, _d, _e;
            let attempts = 0;
            while (attempts < maxAttempts) {
                try {
                    const response = yield axios_1.default.get(`${this.baseUrl}/openapi/v1/remesh/${taskId}`, {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                        },
                        timeout: 10000,
                    });
                    const status = response.data.status || ((_a = response.data.progress) === null || _a === void 0 ? void 0 : _a.status);
                    if (status === 'SUCCEEDED' || status === 'COMPLETED') {
                        return {
                            modelUrl: ((_b = response.data.model_urls) === null || _b === void 0 ? void 0 : _b.glb) ||
                                ((_c = response.data.model_urls) === null || _c === void 0 ? void 0 : _c.gltf) ||
                                response.data.model_url ||
                                response.data.url || '',
                        };
                    }
                    else if (status === 'FAILED' || status === 'ERROR') {
                        throw new Error(`Meshy remesh task failed: ${response.data.error || response.data.message || 'Unknown error'}`);
                    }
                    else {
                        const progress = ((_d = response.data.progress) === null || _d === void 0 ? void 0 : _d.percentage) ||
                            response.data.progress ||
                            response.data.percentage ||
                            0;
                        console.log(`[MeshyProvider] Remesh task ${taskId} progress: ${progress}%`);
                        attempts++;
                        if (attempts < maxAttempts) {
                            yield new Promise(resolve => setTimeout(resolve, intervalMs));
                        }
                    }
                }
                catch (error) {
                    if (((_e = error.response) === null || _e === void 0 ? void 0 : _e.status) === 404) {
                        attempts++;
                        if (attempts < maxAttempts) {
                            yield new Promise(resolve => setTimeout(resolve, intervalMs));
                            continue;
                        }
                    }
                    throw error;
                }
            }
            throw new Error(`Meshy remesh task ${taskId} timed out after ${maxAttempts} attempts`);
        });
    }
}
exports.MeshyProvider = MeshyProvider;
