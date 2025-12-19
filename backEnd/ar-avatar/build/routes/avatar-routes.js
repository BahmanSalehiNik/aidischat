"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.avatarRouter = void 0;
const express_1 = __importDefault(require("express"));
const avatar_service_1 = require("../services/avatar-service");
const router = express_1.default.Router();
exports.avatarRouter = router;
/**
 * GET /api/avatars/:agentId
 * Get avatar for an agent
 */
router.get('/:agentId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { agentId } = req.params;
    const avatar = yield avatar_service_1.avatarService.getAvatar(agentId);
    if (!avatar) {
        return res.status(404).json({ error: 'Avatar not found' });
    }
    res.json(avatar);
}));
/**
 * POST /api/avatars/generate
 * Generate avatar for an agent
 */
router.post('/generate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { agentId, agentProfile } = req.body;
    if (!agentId || !agentProfile) {
        return res.status(400).json({ error: 'agentId and agentProfile are required' });
    }
    try {
        // Start generation (async)
        avatar_service_1.avatarService.generateAvatar(agentId, agentProfile).catch(err => {
            console.error(`[AvatarRoutes] Error generating avatar for ${agentId}:`, err);
        });
        // Return immediately with status
        res.json({
            agentId,
            status: 'generating',
            message: 'Avatar generation started',
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to start avatar generation' });
    }
}));
/**
 * GET /api/avatars/:agentId/status
 * Get avatar generation status with progress
 */
router.get('/:agentId/status', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { agentId } = req.params;
    const status = yield avatar_service_1.avatarService.getAvatarStatus(agentId);
    res.json(status);
}));
/**
 * GET /api/avatars/:agentId/download-url
 * Get signed download URL for avatar model (for private containers)
 * Optional query param: expiresSeconds (default: 900 = 15 minutes)
 */
router.get('/:agentId/download-url', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { agentId } = req.params;
    const expiresSeconds = parseInt(req.query.expiresSeconds) || 900;
    const avatar = yield avatar_service_1.avatarService.getAvatar(agentId);
    if (!avatar) {
        return res.status(404).json({ error: 'Avatar not found' });
    }
    if (!avatar.modelUrl) {
        return res.status(404).json({ error: 'Avatar model not available' });
    }
    if (avatar.status !== 'ready') {
        return res.status(400).json({
            error: 'Avatar not ready',
            status: avatar.status
        });
    }
    // Generate signed URL if needed (for private containers)
    // If modelUrl is already public, return it directly
    try {
        const { storageService } = yield Promise.resolve().then(() => __importStar(require('../services/storage-service')));
        // Check if URL is from our storage (needs signing) or external (already public)
        const isStorageUrl = avatar.modelUrl.includes('.blob.core.windows.net') ||
            avatar.modelUrl.includes('.s3.') ||
            avatar.modelUrl.includes('storage.googleapis.com');
        if (isStorageUrl && avatar.modelUrl) {
            // Parse the blob URL to extract container and blob name properly
            // Remove query string first to get clean URL (SAS token)
            const cleanUrl = avatar.modelUrl.split('?')[0];
            // Parse URL to extract container and blob path
            try {
                const url = new URL(cleanUrl);
                const pathParts = url.pathname.split('/').filter(Boolean);
                if (pathParts.length < 2) {
                    // Invalid URL structure, return stored URL as fallback
                    return res.json({
                        url: avatar.modelUrl,
                        expiresIn: null,
                        format: avatar.format,
                        modelType: avatar.modelType,
                    });
                }
                const containerName = pathParts[0];
                const blobName = pathParts.slice(1).join('/');
                // Generate a fresh signed URL with the requested expiration
                const signedUrl = yield storageService.generateSignedUrlForBlob(containerName, blobName, expiresSeconds);
                return res.json({
                    url: signedUrl,
                    expiresIn: expiresSeconds,
                    format: avatar.format,
                    modelType: avatar.modelType,
                });
            }
            catch (error) {
                console.error(`[AvatarRoutes] Error parsing blob URL:`, error);
                // Fallback: return the stored URL (might already be signed)
                return res.json({
                    url: avatar.modelUrl,
                    expiresIn: null,
                    format: avatar.format,
                    modelType: avatar.modelType,
                });
            }
        }
        // External URL (Meshy, etc.) - return as-is
        return res.json({
            url: avatar.modelUrl,
            expiresIn: null, // External URLs don't expire
            format: avatar.format,
            modelType: avatar.modelType,
        });
    }
    catch (error) {
        console.error(`[AvatarRoutes] Error generating download URL:`, error);
        // Fallback to returning the modelUrl directly
        return res.json({
            url: avatar.modelUrl,
            expiresIn: null,
            format: avatar.format,
            modelType: avatar.modelType,
        });
    }
}));
/**
 * POST /api/avatars/sign-url
 * Sign a blob URL for media service (creates SAS URL with limited lifetime)
 * This endpoint allows other services to request signed URLs for private containers
 */
router.post('/sign-url', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { containerName, blobName, expiresSeconds } = req.body;
    if (!containerName || !blobName) {
        return res.status(400).json({ error: 'containerName and blobName are required' });
    }
    const expiresIn = expiresSeconds || 900; // Default 15 minutes
    try {
        const { storageService } = yield Promise.resolve().then(() => __importStar(require('../services/storage-service')));
        const signedUrl = yield storageService.generateSignedUrlForBlob(containerName, blobName, expiresIn);
        return res.json({
            url: signedUrl,
            expiresIn,
            container: containerName,
            blob: blobName,
        });
    }
    catch (error) {
        console.error(`[AvatarRoutes] Error signing URL for ${containerName}/${blobName}:`, error);
        res.status(500).json({ error: error.message || 'Failed to sign URL' });
    }
}));
