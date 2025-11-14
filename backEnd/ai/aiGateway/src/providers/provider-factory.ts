// src/providers/provider-factory.ts
import { BaseAiProvider } from './base-provider';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { CohereProvider } from './cohere-provider';
import { LocalProvider } from './local-provider';

export class ProviderFactory {
  static createProvider(
    provider: string,
    apiKey?: string,
    endpoint?: string
  ): BaseAiProvider {
    switch (provider.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider(apiKey);
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'cohere':
        return new CohereProvider(apiKey);
      case 'local':
        return new LocalProvider(endpoint);
      case 'custom':
        // For custom providers, you might want to use a generic HTTP client
        // or extend with custom provider implementations
        return new LocalProvider(endpoint); // Using LocalProvider as base for custom
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }
}

