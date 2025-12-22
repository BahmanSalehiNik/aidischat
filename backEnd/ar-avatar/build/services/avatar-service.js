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
Object.defineProperty(exports, "__esModule", { value: true });
exports.avatarService = exports.AvatarService = void 0;
const avatar_1 = require("../models/avatar");
const character_description_generator_1 = require("./character-description-generator");
const model_generator_1 = require("./model-generator");
const storage_service_1 = require("./storage-service");
class AvatarService {
    /**
     * Generate avatar for an agent
     */
    generateAvatar(agentId, agentProfile) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[AvatarService] Generating avatar for agent ${agentId}`);
            // Check if avatar already exists
            const existing = yield avatar_1.Avatar.findByAgentId(agentId);
            if (existing && existing.status === avatar_1.AvatarStatus.Ready) {
                console.log(`[AvatarService] Avatar already exists for agent ${agentId}`);
                return existing;
            }
            // Create or update avatar record
            const avatar = existing || avatar_1.Avatar.build({
                agentId,
                ownerUserId: agentProfile.ownerUserId || agentProfile.ownerId,
                status: avatar_1.AvatarStatus.Pending,
            });
            avatar.status = avatar_1.AvatarStatus.Generating;
            avatar.generationStartedAt = new Date();
            yield avatar.save();
            try {
                // Step 1: Generate character description
                const description = yield character_description_generator_1.characterDescriptionGenerator.generateDescription(agentProfile);
                avatar.characterDescription = description;
                // Step 2: Generate model
                const generatedModel = yield model_generator_1.modelGenerator.generateModel(agentProfile);
                // Step 3: Download and store model (with progress tracking)
                const uploadResult = yield storage_service_1.storageService.downloadAndStore(generatedModel.modelUrl, `${agentId}_${Date.now()}.${generatedModel.format}`, (bytesDownloaded, totalBytes) => {
                    if (totalBytes) {
                        const progress = Math.round((bytesDownloaded / totalBytes) * 100);
                        const mbDownloaded = (bytesDownloaded / 1024 / 1024).toFixed(2);
                        const mbTotal = (totalBytes / 1024 / 1024).toFixed(2);
                        console.log(`[AvatarService] Download progress: ${progress}% (${mbDownloaded} MB / ${mbTotal} MB)`);
                    }
                    else {
                        const mbDownloaded = (bytesDownloaded / 1024 / 1024).toFixed(2);
                        console.log(`[AvatarService] Downloaded: ${mbDownloaded} MB`);
                    }
                });
                // Step 4: Update avatar record
                // Use the URL from uploadResult (already includes CDN URL if configured)
                avatar.modelUrl = uploadResult.url || storage_service_1.storageService.generateCDNUrl(uploadResult.key);
                avatar.format = generatedModel.format;
                avatar.modelType = this.determineModelType(description);
                avatar.provider = generatedModel.modelId.split('_')[0]; // Extract provider from modelId
                avatar.providerModelId = generatedModel.modelId;
                avatar.polygonCount = generatedModel.metadata.polygonCount;
                avatar.textureResolution = generatedModel.metadata.textureResolution;
                avatar.boneCount = generatedModel.metadata.boneCount;
                avatar.animationCount = generatedModel.metadata.animationCount;
                avatar.status = avatar_1.AvatarStatus.Ready;
                avatar.generationCompletedAt = new Date();
                avatar.lipSync = {
                    enabled: true,
                    method: 'viseme',
                };
                avatar.animations = {
                    idle: 'idle',
                    talking: 'talking',
                    gestures: ['wave', 'nod', 'point'],
                };
                yield avatar.save();
                console.log(`[AvatarService] Avatar generated successfully for agent ${agentId}`);
                return avatar;
            }
            catch (error) {
                console.error(`[AvatarService] Error generating avatar for agent ${agentId}:`, error);
                avatar.status = avatar_1.AvatarStatus.Failed;
                avatar.generationError = error.message || 'Unknown error';
                yield avatar.save();
                throw error;
            }
        });
    }
    /**
     * Get avatar for an agent
     */
    getAvatar(agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            return avatar_1.Avatar.findByAgentId(agentId);
        });
    }
    /**
     * Get avatar generation status with detailed progress
     */
    getAvatarStatus(agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const avatar = yield avatar_1.Avatar.findByAgentId(agentId);
            if (!avatar) {
                return { status: avatar_1.AvatarStatus.Pending };
            }
            const progress = this.calculateProgress(avatar);
            let estimatedTimeRemaining;
            if (avatar.status === avatar_1.AvatarStatus.Generating && avatar.generationStartedAt) {
                const elapsed = Date.now() - avatar.generationStartedAt.getTime();
                const estimatedTotal = 30000; // 30 seconds estimated
                estimatedTimeRemaining = Math.max(0, Math.round((estimatedTotal - elapsed) / 1000));
            }
            return {
                status: avatar.status,
                error: avatar.generationError,
                progress,
                modelUrl: avatar.modelUrl,
                format: avatar.format,
                modelType: avatar.modelType,
                estimatedTimeRemaining,
            };
        });
    }
    determineModelType(description) {
        if (description.style === 'anime' || description.style === 'chibi') {
            return avatar_1.AvatarModelType.Anime;
        }
        return avatar_1.AvatarModelType.ThreeD;
    }
    calculateProgress(avatar) {
        if (avatar.status === avatar_1.AvatarStatus.Ready)
            return 100;
        if (avatar.status === avatar_1.AvatarStatus.Failed)
            return 0;
        if (avatar.status === avatar_1.AvatarStatus.Generating) {
            // Estimate progress based on time elapsed
            if (avatar.generationStartedAt) {
                const elapsed = Date.now() - avatar.generationStartedAt.getTime();
                const estimatedTotal = 30000; // 30 seconds
                return Math.min(90, Math.floor((elapsed / estimatedTotal) * 100));
            }
            return 50; // Default progress
        }
        return 0;
    }
}
exports.AvatarService = AvatarService;
exports.avatarService = new AvatarService();
