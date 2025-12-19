"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderFactory = void 0;
const ready_player_me_provider_1 = require("./ready-player-me-provider");
const meshy_provider_1 = require("./meshy-provider");
const constants_1 = require("../../config/constants");
/**
 * Factory for creating model providers
 */
class ProviderFactory {
    /**
     * Create a provider instance by name
     */
    static createProvider(providerName) {
        switch (providerName) {
            case 'ready-player-me':
                return new ready_player_me_provider_1.ReadyPlayerMeProvider(constants_1.AVATAR_CONFIG.READY_PLAYER_ME_API_KEY, constants_1.AVATAR_CONFIG.READY_PLAYER_ME_APP_ID);
            case 'meshy':
                return new meshy_provider_1.MeshyProvider(constants_1.AVATAR_CONFIG.MESHY_API_KEY);
            default:
                throw new Error(`Unknown provider: ${providerName}`);
        }
    }
    /**
     * Get the default provider
     */
    static getDefaultProvider() {
        // Default to Meshy (supports text-to-3D from descriptions)
        // Ready Player Me requires photo-based generation or web builder
        if (constants_1.AVATAR_CONFIG.MESHY_API_KEY) {
            return this.createProvider('meshy');
        }
        // Fallback to Ready Player Me if Meshy is not available
        return this.createProvider('ready-player-me');
    }
    /**
     * Get all available providers
     */
    static getAvailableProviders() {
        const providers = [];
        if (constants_1.AVATAR_CONFIG.READY_PLAYER_ME_API_KEY) {
            providers.push(this.createProvider('ready-player-me'));
        }
        if (constants_1.AVATAR_CONFIG.MESHY_API_KEY) {
            providers.push(this.createProvider('meshy'));
        }
        return providers;
    }
    /**
     * Check if a provider is available
     */
    static isProviderAvailable(providerName) {
        try {
            const provider = this.createProvider(providerName);
            return provider.isAvailable();
        }
        catch (_a) {
            return false;
        }
    }
}
exports.ProviderFactory = ProviderFactory;
