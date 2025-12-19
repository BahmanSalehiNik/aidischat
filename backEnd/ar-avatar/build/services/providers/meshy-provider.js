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
            console.log('[MeshyProvider] Starting model generation with colors and textures...');
            if (!this.isAvailable()) {
                throw new Error('Meshy API key is not configured');
            }
            try {
                // Build prompt from character description
                const prompt = this.buildPrompt(description);
                // Step 1: Create a preview task (base mesh)
                const previewTaskId = yield this.createTask(prompt, description);
                console.log(`[MeshyProvider] Preview task created: ${previewTaskId}`);
                // Step 2: Poll for preview completion
                const previewResult = yield this.pollTask(previewTaskId);
                console.log(`[MeshyProvider] Preview completed: ${previewTaskId}`);
                // Step 3: Create refine task to add colors and textures
                const refineTaskId = yield this.createRefineTask(previewTaskId, prompt, description);
                console.log(`[MeshyProvider] Refine task created: ${refineTaskId}`);
                // Step 4: Poll for refine completion (this adds textures/colors)
                const refineResult = yield this.pollTask(refineTaskId);
                console.log(`[MeshyProvider] Refine completed: ${refineTaskId}`);
                // Step 5: Get final model URL (from refine stage - has colors/textures)
                const modelUrl = refineResult.modelUrl || refineResult.glbUrl || refineResult.url || previewResult.modelUrl;
                if (!modelUrl) {
                    throw new Error('Meshy did not return a model URL');
                }
                return {
                    modelId: `meshy_${refineTaskId || previewTaskId}`,
                    modelUrl,
                    format: avatar_1.AvatarModelFormat.GLB,
                    metadata: {
                        polygonCount: refineResult.polygonCount || previewResult.polygonCount || 15000,
                        textureResolution: refineResult.textureResolution || 2048,
                        boneCount: refineResult.boneCount || 60,
                        animationCount: refineResult.animationCount || 8,
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
            // Meshy API endpoint for text-to-3D
            // Documentation: https://docs.meshy.ai/api-reference/text-to-3d
            const response = yield axios_1.default.post(`${this.baseUrl}/v2/text-to-3d`, {
                prompt,
                mode: 'preview', // Start with preview for base mesh
                art_style: this.mapToArtStyle(description.style),
                negative_prompt: 'blurry, low quality, distorted, deformed, grayscale, monochrome, no colors',
                // Optimize for mobile/AR: keep polygon count reasonable but allow detail
                target_polycount: 15000, // Balance between quality and performance (default 30k, we use 15k for lighter models)
                topology: 'quad', // Quad-dominant mesh for better deformation/animation
                should_remesh: true, // Enable remeshing for cleaner topology
                symmetry_mode: 'auto', // Auto-detect symmetry for better results
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
     * Create a refine task to add textures and colors to the preview model
     */
    createRefineTask(previewTaskId, prompt, description) {
        return __awaiter(this, void 0, void 0, function* () {
            // Meshy refine stage adds textures and colors
            // Documentation: https://docs.meshy.ai/api-reference/text-to-3d
            const response = yield axios_1.default.post(`${this.baseUrl}/v2/text-to-3d`, {
                mode: 'refine', // Refine stage adds textures/colors
                preview_task_id: previewTaskId,
                texture_prompt: prompt, // Use same prompt for texturing
                enable_pbr: description.style === 'realistic', // PBR only for realistic style (other styles map to sculpture which has its own PBR)
                // Keep textures optimized for mobile
                texture_resolution: 1024, // 1024x1024 instead of default 2048 (lighter, still good quality)
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
}
exports.MeshyProvider = MeshyProvider;
