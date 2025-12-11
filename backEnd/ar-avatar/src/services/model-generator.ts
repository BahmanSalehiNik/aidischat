import { AVATAR_CONFIG } from '../config/constants';
import { CharacterDescription, CharacterDescriptionGenerator } from './character-description-generator';
import { AvatarModelType } from '../models/avatar';
import { IModelProvider, GeneratedModel } from './providers/base-provider';
import { ProviderFactory } from './providers/provider-factory';

export { GeneratedModel } from './providers/base-provider';

export class ModelGenerator {
  private descriptionGenerator: CharacterDescriptionGenerator;
  private defaultProvider: IModelProvider;

  constructor() {
    this.descriptionGenerator = new CharacterDescriptionGenerator();
    this.defaultProvider = ProviderFactory.getDefaultProvider();
  }

  /**
   * Generate 3D model from agent profile
   * Step 1: Generate character description (LLM)
   * Step 2: Generate model (3D provider)
   */
  async generateModel(
    agentProfile: any,
    preferredStyle?: '3d' | 'anime',
    providerName?: 'ready-player-me' | 'meshy'
  ): Promise<GeneratedModel> {
    console.log(`[ModelGenerator] Starting model generation for agent ${agentProfile.id || agentProfile.agentId}`);

    // Step 1: Generate character description
    console.log('[ModelGenerator] Step 1: Generating character description...');
    const description = await this.descriptionGenerator.generateDescription(agentProfile);
    console.log('[ModelGenerator] Character description generated:', JSON.stringify(description, null, 2));

    // Step 2: Select provider
    const provider = providerName 
      ? ProviderFactory.createProvider(providerName)
      : this.selectProvider(description, preferredStyle);

    // Step 3: Generate model using provider
    console.log(`[ModelGenerator] Step 2: Generating model using ${provider.getName()}...`);
    const agentId = agentProfile.id || agentProfile.agentId;
    const model = await provider.generateModel(description, agentId);

    console.log(`[ModelGenerator] Model generation completed: ${model.modelId}`);
    return model;
  }

  /**
   * Select provider based on description and preferences
   */
  private selectProvider(
    description: CharacterDescription,
    preferredStyle?: '3d' | 'anime'
  ): IModelProvider {
    // Meshy supports text-to-3D from descriptions (works for all styles)
    // Ready Player Me only supports photo-based generation or web builder
    // So we prefer Meshy by default
    if (ProviderFactory.isProviderAvailable('meshy')) {
      return ProviderFactory.createProvider('meshy');
    }
    
    // Fallback to Ready Player Me if Meshy is not available
    // Note: Ready Player Me requires photo-based generation, not programmatic creation
    return this.defaultProvider;
  }
}

export const modelGenerator = new ModelGenerator();

