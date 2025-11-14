// src/providers/anthropic-provider.ts
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { BaseAiProvider, AiProviderRequest, AiProviderResponse, AgentCreationRequest, AgentCreationResponse } from './base-provider';

export class AnthropicProvider extends BaseAiProvider {
  private client: Anthropic;

  constructor(apiKey?: string) {
    super(apiKey);
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.client = new Anthropic({ apiKey });
  }

  async generateResponse(request: AiProviderRequest): Promise<AiProviderResponse> {
    this.validateRequest(request);

    try {
      const message = await this.client.messages.create({
        model: request.modelName,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
        system: request.systemPrompt || 'You are a helpful assistant.',
        messages: [
          { role: 'user', content: request.message },
        ],
      });

      // Anthropic returns content as an array of text blocks
      const content = message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      return {
        content,
        usage: {
          promptTokens: message.usage?.input_tokens,
          completionTokens: message.usage?.output_tokens,
          totalTokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
        },
      };
    } catch (error: any) {
      console.error('Anthropic API error:', error);
      return {
        content: '',
        error: error.message || 'Failed to generate response from Anthropic',
      };
    }
  }

  async createAgent(request: AgentCreationRequest): Promise<AgentCreationResponse> {
    try {
      // Anthropic doesn't have a persistent assistant/agent API like OpenAI
      // Instead, we validate the configuration and create a deterministic ID
      // The configuration will be stored in our system and used when generating responses

      // Validate the model is accessible by making a test call
      // We'll use a minimal test to verify the API key and model work
      try {
        await this.client.messages.create({
          model: request.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        });
      } catch (validationError: any) {
        // If validation fails, it's likely an invalid model or API key
        const retryable = this.isRetryableError(validationError);
        return {
          providerAgentId: '',
          error: validationError.message || 'Failed to validate Anthropic model configuration',
          retryable,
          metadata: {
            errorType: validationError.type,
            errorCode: validationError.status,
          },
        };
      }

      // Create a deterministic ID based on configuration
      // This ensures the same configuration always gets the same ID
      const configHash = createHash('sha256')
        .update(JSON.stringify({
          model: request.model,
          instructions: request.instructions,
          name: request.name,
        }))
        .digest('hex')
        .substring(0, 16);

      const providerAgentId = `anthropic-${configHash}`;

      return {
        providerAgentId,
        metadata: {
          provider: 'anthropic',
          model: request.model,
          configHash,
          note: 'Anthropic does not support persistent assistants. Configuration is stored locally.',
        },
      };
    } catch (error: any) {
      console.error('Anthropic agent creation error:', error);
      
      const retryable = this.isRetryableError(error);
      
      return {
        providerAgentId: '',
        error: error.message || 'Failed to create Anthropic agent configuration',
        retryable,
        metadata: {
          errorType: error.type,
          errorCode: error.status,
        },
      };
    }
  }

  private isRetryableError(error: any): boolean {
    // Retryable errors: rate limits, timeouts, server errors
    const status = error.status || error.statusCode;
    if (status === 429 || status === 503 || status === 500) {
      return true;
    }
    // Non-retryable: authentication, invalid requests, not found
    if (status === 401 || status === 400 || status === 404) {
      return false;
    }
    // Default to retryable for unknown errors
    return true;
  }
}

