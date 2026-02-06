// src/providers/base-provider.ts
export interface AiProviderResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  error?: string;
}

export interface AiProviderRequest {
  message: string;
  systemPrompt: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{ name: string; config: any }>;
  assistantId?: string; // For OpenAI Assistants API - the providerAgentId
  threadId?: string; // For OpenAI Assistants API - the thread ID (one per room+agent)
  /**
   * Optional image URLs to include as multimodal inputs for vision-capable models.
   * Providers that do not support vision will ignore this field.
   */
  imageUrls?: string[];
  /**
   * Optional hint to force the provider to return machine-parseable JSON.
   * Only some providers support this.
   */
  responseFormat?: 'text' | 'json_object';
}

export interface AgentCreationRequest {
  name: string;
  instructions: string;
  model: string;
  tools?: Array<{ name: string; config: any }>;
  metadata?: Record<string, string>;
}

export interface AgentCreationResponse {
  providerAgentId: string;
  metadata?: Record<string, any>;
  error?: string;
  retryable?: boolean;
}

export abstract class BaseAiProvider {
  protected apiKey?: string;
  protected endpoint?: string;

  constructor(apiKey?: string, endpoint?: string) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  abstract generateResponse(request: AiProviderRequest): Promise<AiProviderResponse>;
  
  /**
   * Create an agent/assistant in the provider's system
   * @param request Agent creation configuration
   * @returns Provider-specific agent ID and metadata
   */
  abstract createAgent(request: AgentCreationRequest): Promise<AgentCreationResponse>;

  /**
   * Stream response from AI provider (optional - providers can implement if they support streaming)
   * @param request AI provider request
   * @param onChunk Callback for each chunk received
   */
  async streamResponse?(
    request: AiProviderRequest,
    onChunk: (chunk: string) => Promise<void>
  ): Promise<void> {
    // Default implementation: generate full response and call onChunk with it
    const response = await this.generateResponse(request);
    if (response.content) {
      await onChunk(response.content);
    }
  }

  protected validateRequest(request: AiProviderRequest): void {
    if (!request.message || !request.message.trim()) {
      throw new Error('Message content is required');
    }
    if (!request.modelName) {
      throw new Error('Model name is required');
    }
  }
}

