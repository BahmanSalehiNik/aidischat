// src/providers/openai-provider.ts
import OpenAI from 'openai';
import { BaseAiProvider, AiProviderRequest, AiProviderResponse, AgentCreationRequest, AgentCreationResponse } from './base-provider';

export class OpenAIProvider extends BaseAiProvider {
  private client: OpenAI;

  constructor(apiKey?: string) {
    super(apiKey);
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  async generateResponse(request: AiProviderRequest): Promise<AiProviderResponse> {
    this.validateRequest(request);

    try {
      const completion = await this.client.chat.completions.create({
        model: request.modelName,
        messages: [
          { role: 'system', content: request.systemPrompt || 'You are a helpful assistant.' },
          { role: 'user', content: request.message },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        // TODO: Handle tools if needed
      });

      const content = completion.choices[0]?.message?.content || '';
      
      return {
        content,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
      };
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      return {
        content: '',
        error: error.message || 'Failed to generate response from OpenAI',
      };
    }
  }

  async createAgent(request: AgentCreationRequest): Promise<AgentCreationResponse> {
    try {
      // Convert tools format if provided
      const tools: any[] = [];
      if (request.tools && request.tools.length > 0) {
        // OpenAI expects tools in a specific format
        // For now, we'll support function calling tools
        for (const tool of request.tools) {
          if (tool.name && tool.config) {
            // If config has function definition, use it
            if (tool.config.type === 'function' && tool.config.function) {
              tools.push({
                type: 'function',
                function: tool.config.function,
              });
            } else {
              // Otherwise, create a basic function tool
              tools.push({
                type: 'function',
                function: {
                  name: tool.name,
                  description: tool.config.description || `Tool: ${tool.name}`,
                  parameters: tool.config.parameters || {},
                },
              });
            }
          }
        }
      }

      // Create assistant using OpenAI Assistants API
      const assistant = await this.client.beta.assistants.create({
        name: request.name,
        instructions: request.instructions,
        model: request.model,
        tools: tools.length > 0 ? tools : undefined,
        metadata: request.metadata,
      });

      return {
        providerAgentId: assistant.id,
        metadata: {
          createdAt: assistant.created_at,
          object: assistant.object,
          description: assistant.description,
          toolCount: assistant.tools?.length || 0,
        },
      };
    } catch (error: any) {
      console.error('OpenAI Assistant creation error:', error);
      
      // Determine if error is retryable
      const retryable = this.isRetryableError(error);
      
      return {
        providerAgentId: '',
        error: error.message || 'Failed to create OpenAI assistant',
        retryable,
        metadata: {
          errorType: error.type,
          errorCode: error.code,
          statusCode: error.status,
        },
      };
    }
  }

  private isRetryableError(error: any): boolean {
    // Retryable errors: rate limits, timeouts, server errors
    if (error.status === 429 || error.status === 503 || error.status === 500) {
      return true;
    }
    // Non-retryable: authentication, invalid requests, not found
    if (error.status === 401 || error.status === 400 || error.status === 404) {
      return false;
    }
    // Default to retryable for unknown errors
    return true;
  }
}

