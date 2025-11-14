// src/providers/local-provider.ts
import axios, { AxiosInstance } from 'axios';
import { createHash } from 'crypto';
import { BaseAiProvider, AiProviderRequest, AiProviderResponse, AgentCreationRequest, AgentCreationResponse } from './base-provider';

export class LocalProvider extends BaseAiProvider {
  private client: AxiosInstance;

  constructor(endpoint?: string) {
    super(undefined, endpoint);
    if (!endpoint) {
      throw new Error('Local LLM endpoint is required');
    }
    this.client = axios.create({
      baseURL: endpoint,
      timeout: 60000, // 60 seconds timeout for local LLMs
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async generateResponse(request: AiProviderRequest): Promise<AiProviderResponse> {
    this.validateRequest(request);

    try {
      // Standard OpenAI-compatible API format for local LLMs (like vLLM, Ollama, etc.)
      const response = await this.client.post('/v1/chat/completions', {
        model: request.modelName,
        messages: [
          { role: 'system', content: request.systemPrompt || 'You are a helpful assistant.' },
          { role: 'user', content: request.message },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
      });

      const content = response.data.choices?.[0]?.message?.content || '';
      
      return {
        content,
        usage: {
          promptTokens: response.data.usage?.prompt_tokens,
          completionTokens: response.data.usage?.completion_tokens,
          totalTokens: response.data.usage?.total_tokens,
        },
      };
    } catch (error: any) {
      console.error('Local LLM API error:', error);
      return {
        content: '',
        error: error.message || 'Failed to generate response from local LLM',
      };
    }
  }

  async createAgent(request: AgentCreationRequest): Promise<AgentCreationResponse> {
    try {
      // Local providers typically don't have persistent assistant APIs
      // Validate the endpoint and model are accessible
      try {
        await this.client.post('/v1/chat/completions', {
          model: request.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        });
      } catch (validationError: any) {
        const retryable = this.isRetryableError(validationError);
        return {
          providerAgentId: '',
          error: validationError.message || 'Failed to validate local LLM configuration',
          retryable,
          metadata: {
            errorCode: validationError.response?.status || validationError.code,
          },
        };
      }

      // Create a deterministic ID based on configuration
      const configHash = createHash('sha256')
        .update(JSON.stringify({
          endpoint: this.endpoint,
          model: request.model,
          instructions: request.instructions,
          name: request.name,
        }))
        .digest('hex')
        .substring(0, 16);

      const providerAgentId = `local-${configHash}`;

      return {
        providerAgentId,
        metadata: {
          provider: 'local',
          endpoint: this.endpoint,
          model: request.model,
          configHash,
          note: 'Local providers do not support persistent assistants. Configuration is stored locally.',
        },
      };
    } catch (error: any) {
      console.error('Local LLM agent creation error:', error);
      
      const retryable = this.isRetryableError(error);
      
      return {
        providerAgentId: '',
        error: error.message || 'Failed to create local LLM agent configuration',
        retryable,
        metadata: {
          errorCode: error.response?.status || error.code,
        },
      };
    }
  }

  private isRetryableError(error: any): boolean {
    const status = error.response?.status || error.status || error.statusCode;
    // Retryable errors: timeouts, server errors
    if (status === 503 || status === 500 || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
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

