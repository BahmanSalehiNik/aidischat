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
exports.ReadyPlayerMeProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const base_provider_1 = require("./base-provider");
const avatar_1 = require("../../models/avatar");
const constants_1 = require("../../config/constants");
/**
 * Ready Player Me provider implementation
 * Documentation: https://docs.readyplayer.me/ready-player-me/api-reference/rest-api
 * Authentication: Uses X-API-Key and X-App-Key headers
 */
class ReadyPlayerMeProvider extends base_provider_1.BaseModelProvider {
    constructor(apiKey, appId) {
        super(apiKey, 'https://api.readyplayer.me');
        this.appId = appId || constants_1.AVATAR_CONFIG.READY_PLAYER_ME_APP_ID;
        if (!this.appId) {
            console.warn('[ReadyPlayerMeProvider] App ID not configured - some API calls may fail');
        }
    }
    getName() {
        return 'ready-player-me';
    }
    generateModel(description, agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('[ReadyPlayerMeProvider] Starting model generation...');
            if (!this.isAvailable()) {
                throw new Error('Ready Player Me API key is not configured');
            }
            try {
                // Build avatar configuration from character description
                const avatarConfig = this.buildAvatarConfig(description);
                // Create avatar using Ready Player Me API
                const avatarId = yield this.createAvatar(avatarConfig, agentId);
                console.log(`[ReadyPlayerMeProvider] Avatar created: ${avatarId}`);
                // Get avatar model URL
                const modelUrl = yield this.getModelUrl(avatarId);
                console.log(`[ReadyPlayerMeProvider] Model URL retrieved: ${modelUrl}`);
                return {
                    modelId: `rpm_${avatarId}`,
                    modelUrl,
                    format: avatar_1.AvatarModelFormat.GLB,
                    metadata: {
                        polygonCount: 10000,
                        textureResolution: 2048,
                        boneCount: 75,
                        animationCount: 10,
                    },
                };
            }
            catch (error) {
                console.error('[ReadyPlayerMeProvider] Generation error:', error);
                throw new Error(`Ready Player Me generation failed: ${error.message}`);
            }
        });
    }
    buildAvatarConfig(description) {
        // Ready Player Me uses a specific configuration format
        // Based on their API documentation
        // Note: applicationId is now sent in X-App-Key header, not in body
        const config = {
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
    mapToFaceShape(description) {
        // Map expression baseline to face shape
        if (description.expressionBaseline === 'cute')
            return 'round';
        if (description.expressionBaseline === 'dramatic')
            return 'angular';
        return 'oval'; // default
    }
    mapToHairStyle(style) {
        // Map common hair styles to Ready Player Me options
        const styleMap = {
            'long': 'long',
            'short': 'short',
            'medium': 'medium',
            'curly': 'curly',
            'straight': 'straight',
            'wavy': 'wavy',
        };
        return styleMap[style.toLowerCase()] || 'medium';
    }
    mapToColor(color) {
        // Map color names to hex codes or Ready Player Me color IDs
        const colorMap = {
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
    mapToSkinTone(description) {
        // Default skin tone mapping
        return '#FFDBB3'; // Light skin tone as default
    }
    createAvatar(config, agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Ready Player Me API endpoint for creating avatars
            // Documentation: https://docs.readyplayer.me/ready-player-me/api-reference/avatars
            // Authentication: Uses x-api-key and x-app-key headers (lowercase)
            try {
                const headers = {
                    'x-api-key': this.apiKey, // lowercase header
                    'Content-Type': 'application/json',
                };
                // Add App Key header if available
                if (this.appId) {
                    headers['x-app-key'] = this.appId; // lowercase header
                    console.log('[ReadyPlayerMeProvider] Using App ID:', this.appId.substring(0, 8) + '...');
                }
                else {
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
                        data: config // Nested data object contains the actual avatar config
                    }
                };
                console.log('[ReadyPlayerMeProvider] Request body structure:', JSON.stringify(requestBody, null, 2));
                const response = yield axios_1.default.post(`${this.baseUrl}/v1/avatars`, requestBody, {
                    headers,
                    timeout: 30000,
                });
                if (!response.data || !response.data.id) {
                    throw new Error('Invalid response from Ready Player Me API');
                }
                return response.data.id;
            }
            catch (error) {
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
        });
    }
    getModelUrl(avatarId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the GLB model URL for the avatar
            // Ready Player Me provides different formats: glb, gltf, etc.
            try {
                const headers = {
                    'x-api-key': this.apiKey, // lowercase header (not Authorization Bearer)
                };
                // Add App Key header if available
                if (this.appId) {
                    headers['x-app-key'] = this.appId; // lowercase header
                }
                const response = yield axios_1.default.get(`${this.baseUrl}/v1/avatars/${avatarId}`, {
                    headers,
                    timeout: 10000,
                });
                // If direct URL is available in response
                if (response.data && response.data.url) {
                    return response.data.url;
                }
                // Check for GLB URL
                if (response.data && response.data.glbUrl) {
                    return response.data.glbUrl;
                }
            }
            catch (error) {
                console.warn('[ReadyPlayerMeProvider] Could not fetch avatar details, using fallback URL');
            }
            // Fallback: construct URL from avatar ID
            // Ready Player Me typically serves models at: https://models.readyplayer.me/{avatarId}.glb
            return `https://models.readyplayer.me/${avatarId}.glb`;
        });
    }
}
exports.ReadyPlayerMeProvider = ReadyPlayerMeProvider;
