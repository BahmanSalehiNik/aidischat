import { CharacterDescription } from '../character-description-generator';
import { AvatarModelFormat } from '../../models/avatar';

export interface GeneratedModel {
  modelId: string;
  modelUrl: string;
  format: AvatarModelFormat;
  animationUrls?: string[]; // Separate animation GLB URLs (for Meshy)
  metadata: {
    polygonCount?: number;
    textureResolution?: number;
    boneCount?: number;
    animationCount?: number;
  };
}

/**
 * Base interface for 3D model generation providers
 */
export interface IModelProvider {
  /**
   * Generate a 3D model from character description
   */
  generateModel(description: CharacterDescription, agentId?: string): Promise<GeneratedModel>;

  /**
   * Get provider name
   */
  getName(): string;

  /**
   * Check if provider is available/configured
   */
  isAvailable(): boolean;
}

/**
 * Base class for model providers with common functionality
 */
export abstract class BaseModelProvider implements IModelProvider {
  protected apiKey: string;
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  abstract generateModel(description: CharacterDescription, agentId?: string): Promise<GeneratedModel>;
  abstract getName(): string;

  isAvailable(): boolean {
    return !!this.apiKey && !!this.baseUrl;
  }

  /**
   * Build a prompt from character description (common implementation)
   */
  protected buildPrompt(description: CharacterDescription): string {
    const parts: string[] = [];
    
    // Style and appearance
    parts.push(`${description.style} style character`);
    if (description.subcategory) {
      parts.push(description.subcategory);
    }
    
    // Gender and species
    parts.push(`${description.gender} ${description.species}`);
    
    // Body type
    parts.push(`${description.bodyType} body type`);
    if (description.height) {
      parts.push(`${description.height} height`);
    }
    
    // Hair
    if (description.hair) {
      parts.push(`${description.hair.color} ${description.hair.style} hair`);
    }
    
    // Eyes
    if (description.eyes) {
      parts.push(`${description.eyes.color} eyes`);
    }
    
    // Clothing
    if (description.clothing) {
      parts.push(`wearing ${description.clothing}`);
    }
    
    // Accessories
    if (description.accessories && description.accessories.length > 0) {
      parts.push(`with ${description.accessories.join(', ')}`);
    }
    
    // Expression
    if (description.expressionBaseline) {
      parts.push(`${description.expressionBaseline} expression`);
    }

    return parts.join(', ');
  }
}

