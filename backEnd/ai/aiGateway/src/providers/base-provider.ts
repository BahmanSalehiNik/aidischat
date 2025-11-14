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

  protected validateRequest(request: AiProviderRequest): void {
    if (!request.message || !request.message.trim()) {
      throw new Error('Message content is required');
    }
    if (!request.modelName) {
      throw new Error('Model name is required');
    }
  }
}

