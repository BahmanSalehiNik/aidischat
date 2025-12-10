import { IModelProvider } from './base-provider';
import { ReadyPlayerMeProvider } from './ready-player-me-provider';
import { MeshyProvider } from './meshy-provider';
import { AVATAR_CONFIG } from '../../config/constants';

/**
 * Factory for creating model providers
 */
export class ProviderFactory {
  /**
   * Create a provider instance by name
   */
  static createProvider(providerName: 'ready-player-me' | 'meshy'): IModelProvider {
    switch (providerName) {
      case 'ready-player-me':
        return new ReadyPlayerMeProvider(AVATAR_CONFIG.READY_PLAYER_ME_API_KEY);
      
      case 'meshy':
        return new MeshyProvider(AVATAR_CONFIG.MESHY_API_KEY);
      
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  /**
   * Get the default provider
   */
  static getDefaultProvider(): IModelProvider {
    // Default to Ready Player Me
    return this.createProvider('ready-player-me');
  }

  /**
   * Get all available providers
   */
  static getAvailableProviders(): IModelProvider[] {
    const providers: IModelProvider[] = [];
    
    if (AVATAR_CONFIG.READY_PLAYER_ME_API_KEY) {
      providers.push(this.createProvider('ready-player-me'));
    }
    
    if (AVATAR_CONFIG.MESHY_API_KEY) {
      providers.push(this.createProvider('meshy'));
    }
    
    return providers;
  }

  /**
   * Check if a provider is available
   */
  static isProviderAvailable(providerName: 'ready-player-me' | 'meshy'): boolean {
    try {
      const provider = this.createProvider(providerName);
      return provider.isAvailable();
    } catch {
      return false;
    }
  }
}

