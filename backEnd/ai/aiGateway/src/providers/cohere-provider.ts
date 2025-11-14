// src/providers/cohere-provider.ts
import { createHash } from 'crypto';
import { CohereClient } from 'cohere-ai';
import {
  BaseAiProvider,
  AiProviderRequest,
  AiProviderResponse,
  AgentCreationRequest,
  AgentCreationResponse,
} from './base-provider';

export class CohereProvider extends BaseAiProvider {
  private client: CohereClient;

  constructor(apiKey?: string) {
    super(apiKey);
    if (!apiKey) {
      throw new Error('Cohere API key is required');
    }

    this.client = new CohereClient({ token: apiKey });
  }

  async generateResponse(request: AiProviderRequest): Promise<AiProviderResponse> {
    this.validateRequest(request);

    try {
      const response = await this.client.chat({
        model: request.modelName,
        message: request.message,
        preamble: request.systemPrompt || 'You are a helpful assistant.',
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens,
      });

      const promptTokens = response?.meta?.tokens?.inputTokens;
      const completionTokens = response?.meta?.tokens?.outputTokens;

      return {
        content: response?.text ?? '',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens:
            promptTokens !== undefined && completionTokens !== undefined
              ? promptTokens + completionTokens
              : undefined,
        },
      };
    } catch (error: any) {
      console.error('Cohere API error:', error);
      return {
        content: '',
        error: error?.message || 'Failed to generate response from Cohere',
      };
    }
  }

  async createAgent(request: AgentCreationRequest): Promise<AgentCreationResponse> {
    try {
      try {
        await this.client.chat({
          model: request.model,
          message: 'Configuration validation ping',
          preamble: request.instructions,
          temperature: 0.1,
          maxTokens: 1,
        });
      } catch (validationError: any) {
        return {
          providerAgentId: '',
          error: validationError?.message || 'Failed to validate Cohere model configuration',
          retryable: this.isRetryableError(validationError),
          metadata: {
            errorCode: validationError?.status,
            errorType: validationError?.code,
          },
        };
      }

      const configHash = createHash('sha256')
        .update(
          JSON.stringify({
            model: request.model,
            instructions: request.instructions,
            name: request.name,
          })
        )
        .digest('hex')
        .substring(0, 16);

      const providerAgentId = `cohere-${configHash}`;

      return {
        providerAgentId,
        metadata: {
          provider: 'cohere',
          model: request.model,
          configHash,
          note: 'Cohere does not support persistent assistants. Configuration is stored locally.',
        },
      };
    } catch (error: any) {
      console.error('Cohere agent creation error:', error);
      return {
        providerAgentId: '',
        error: error?.message || 'Failed to create Cohere agent configuration',
        retryable: this.isRetryableError(error),
        metadata: {
          errorCode: error?.status,
          errorType: error?.code,
        },
      };
    }
  }

  private isRetryableError(error: any): boolean {
    const status = error?.status ?? error?.statusCode;
    if (status === 429 || status === 500 || status === 502 || status === 503) {
      return true;
    }

    if (status === 400 || status === 401 || status === 404) {
      return false;
    }

    return true;
  }
}


