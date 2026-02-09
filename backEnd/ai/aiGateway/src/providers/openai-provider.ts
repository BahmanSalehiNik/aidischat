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

    console.log(`[OpenAI Provider] generateResponse called:`, {
      hasAssistantId: !!request.assistantId,
      hasThreadId: !!request.threadId,
      assistantId: request.assistantId,
      threadId: request.threadId,
      messageLength: request.message.length,
      imageCount: request.imageUrls?.length || 0,
    });

    try {
      // If assistantId is provided, use Assistants API (threads and runs)
      // Otherwise, fall back to Chat Completions API for backward compatibility
      if (request.assistantId) {
        console.log(`[OpenAI Provider] ✅ Using Assistants API path (assistantId provided)`);
        return await this.generateResponseWithAssistant(request);
      } else {
        console.log(`[OpenAI Provider] ⚠️ Using Chat Completions API path (no assistantId, fallback mode)`);
        // Fallback to Chat Completions API
        const userContent: any =
          request.imageUrls && request.imageUrls.length > 0
            ? [
                { type: 'text', text: request.message },
                ...request.imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
              ]
            : request.message;

        const completion = await this.client.chat.completions.create({
          model: request.modelName,
          messages: [
            { role: 'system', content: request.systemPrompt || 'You are a helpful assistant.' },
            { role: 'user', content: userContent },
          ],
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          response_format: request.responseFormat === 'json_object' ? ({ type: 'json_object' } as any) : undefined,
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
      }
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      return {
        content: '',
        error: error.message || 'Failed to generate response from OpenAI',
      };
    }
  }

  private async generateResponseWithAssistant(request: AiProviderRequest): Promise<AiProviderResponse> {
    if (!request.assistantId) {
      throw new Error('Assistant ID is required for Assistants API');
    }
    if (!request.threadId) {
      throw new Error('Thread ID is required for Assistants API');
    }

    console.log(`[OpenAI Provider] ========== ASSISTANTS API FLOW START ==========`);
    console.log(`[OpenAI Provider] Assistant ID: ${request.assistantId}`);
    console.log(`[OpenAI Provider] Thread ID: ${request.threadId}`);
    console.log(`[OpenAI Provider] Message: "${request.message.substring(0, 100)}..."`);
    
    // VERIFY: Retrieve the assistant to confirm it exists and check its instructions
    try {
      const verifyAssistant = await this.client.beta.assistants.retrieve(request.assistantId);
      console.log(`[OpenAI Provider] ✅ Verified assistant exists: ${verifyAssistant.id}`);
      console.log(`[OpenAI Provider] Assistant name: ${verifyAssistant.name}`);
      console.log(`[OpenAI Provider] Assistant instructions length: ${verifyAssistant.instructions?.length || 0}`);
      if (verifyAssistant.instructions) {
        console.log(`[OpenAI Provider] Assistant instructions preview: "${verifyAssistant.instructions.substring(0, 200)}..."`);
      }
    } catch (verifyError: any) {
      console.error(`[OpenAI Provider] ❌ Failed to verify assistant ${request.assistantId}:`, verifyError.message);
      throw new Error(`Assistant ${request.assistantId} not found or inaccessible: ${verifyError.message}`);
    }

    try {
      // Step 1: Use existing thread (threadId is passed in request)
      const threadId = request.threadId;
      console.log(`[OpenAI Provider] Using existing thread: ${threadId}`);

      // Step 2: Add message to thread
      const threadMessageContent: any =
        request.imageUrls && request.imageUrls.length > 0
          ? [
              { type: 'text', text: request.message },
              ...request.imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
            ]
          : request.message;

      await this.client.beta.threads.messages.create(threadId, {
        role: 'user',
        content: threadMessageContent,
      });
      console.log(`[OpenAI Provider] Added message to thread ${threadId}`);

      // Step 3: Create a run with the assistant ID
      const run = await this.client.beta.threads.runs.create(threadId, {
        assistant_id: request.assistantId,
      });
      console.log(`[OpenAI Provider] Created run ${run.id} with assistant ${request.assistantId}`);

      // Step 4: Poll for completion
      let runStatus = await this.client.beta.threads.runs.retrieve(threadId, run.id);
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max wait

      while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
        if (attempts >= maxAttempts) {
          throw new Error('Run timeout: assistant took too long to respond');
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        runStatus = await this.client.beta.threads.runs.retrieve(threadId, run.id);
        attempts++;
        console.log(`[OpenAI Provider] Run ${run.id} status: ${runStatus.status} (attempt ${attempts})`);
      }

      if (runStatus.status === 'failed') {
        const errorMessage = runStatus.last_error?.message || 'Run failed';
        console.error(`[OpenAI Provider] Run failed: ${errorMessage}`);
        throw new Error(`Assistant run failed: ${errorMessage}`);
      }

      if (runStatus.status !== 'completed') {
        throw new Error(`Unexpected run status: ${runStatus.status}`);
      }

      console.log(`[OpenAI Provider] Run ${run.id} completed successfully`);

      // Step 5: Retrieve messages from thread
      const messages = await this.client.beta.threads.messages.list(threadId);
      console.log(`[OpenAI Provider] Retrieved ${messages.data.length} messages from thread`);
      
      // Find the assistant message for this run
      const assistantMessage = messages.data.find((msg: any) => msg.role === 'assistant' && msg.run_id === run.id);

      if (!assistantMessage) {
        console.error(`[OpenAI Provider] No assistant message found for run ${run.id}`);
        console.error(`[OpenAI Provider] Available messages:`, messages.data.map((m: any) => ({
          role: m.role,
          run_id: m.run_id,
          id: m.id,
        })));
        throw new Error('No assistant message found in thread');
      }

      console.log(`[OpenAI Provider] Found assistant message:`, {
        messageId: assistantMessage.id,
        role: assistantMessage.role,
        runId: assistantMessage.run_id,
        contentType: typeof assistantMessage.content,
        contentLength: Array.isArray(assistantMessage.content) ? assistantMessage.content.length : 'not array',
      });

      // Extract text content from message
      // Content is an array of content blocks
      let content = '';
      if (Array.isArray(assistantMessage.content)) {
        console.log(`[OpenAI Provider] Content blocks structure:`, JSON.stringify(assistantMessage.content, null, 2));
        
        content = assistantMessage.content
          .filter((block: any) => {
            if (block.type === 'text') {
              return true;
            }
            console.log(`[OpenAI Provider] Skipping non-text block:`, block.type);
            return false;
          })
          .map((block: any) => {
            // Handle different text block formats
            // Format 1: block.text is a string
            if (typeof block.text === 'string') {
              return block.text;
            }
            // Format 2: block.text is an object with .value
            if (block.text && typeof block.text === 'object' && typeof block.text.value === 'string') {
              return block.text.value;
            }
            // Format 3: block has .text property that's an object
            if (block.text && typeof block.text === 'object') {
              console.warn(`[OpenAI Provider] Text block has object structure:`, JSON.stringify(block.text, null, 2));
              // Try to extract any string value
              const textValue = block.text.value || block.text.content || JSON.stringify(block.text);
              if (typeof textValue === 'string') {
                return textValue;
              }
            }
            // Fallback: log and return empty
            console.warn(`[OpenAI Provider] Unexpected text block format:`, JSON.stringify(block, null, 2));
            return '';
          })
          .filter((text: string) => text && text.length > 0)
          .join('\n');
      } else {
        console.error(`[OpenAI Provider] Content is not an array:`, typeof assistantMessage.content);
        console.error(`[OpenAI Provider] Content value:`, JSON.stringify(assistantMessage.content, null, 2));
        throw new Error('Assistant message content is not in expected format');
      }

      if (!content || content.trim().length === 0) {
        console.error(`[OpenAI Provider] Empty content extracted from assistant message`);
        console.error(`[OpenAI Provider] Full message structure:`, JSON.stringify(assistantMessage, null, 2));
        throw new Error('Assistant returned empty response');
      }

      console.log(`[OpenAI Provider] ✅ Retrieved response from assistant (${content.length} chars)`);
      console.log(`[OpenAI Provider] Response preview: "${content.substring(0, 200)}..."`);
      console.log(`[OpenAI Provider] ========== ASSISTANTS API FLOW COMPLETE ==========`);

      // Get usage from run if available
      const usage = runStatus.usage ? {
        promptTokens: runStatus.usage.prompt_tokens,
        completionTokens: runStatus.usage.completion_tokens,
        totalTokens: runStatus.usage.total_tokens,
      } : undefined;

      return {
        content,
        usage,
      };
    } catch (error: any) {
      console.error('[OpenAI Provider] Assistants API error:', error);
      throw error;
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

      // Log instructions being sent to OpenAI (for debugging)
      console.log(`[OpenAI Provider] Creating assistant "${request.name}" with instructions (${request.instructions.length} chars)`);
      if (request.instructions.length > 0) {
        console.log(`[OpenAI Provider] ========== FULL INSTRUCTIONS BEING SENT TO OPENAI ==========`);
        console.log(request.instructions);
        console.log(`[OpenAI Provider] ========== END OF INSTRUCTIONS ==========`);
      } else {
        console.warn(`[OpenAI Provider] ⚠️ WARNING: Instructions are empty!`);
      }

      // Create assistant using OpenAI Assistants API
      const assistant = await this.client.beta.assistants.create({
        name: request.name,
        instructions: request.instructions,
        model: request.model,
        tools: tools.length > 0 ? tools : undefined,
        metadata: request.metadata,
      });

      console.log(`[OpenAI Provider] ✅ Assistant created successfully: ${assistant.id}`);

      // VERIFICATION: Retrieve the assistant immediately to verify instructions were stored correctly
      let retrievedAssistant: any = null;
      try {
        retrievedAssistant = await this.client.beta.assistants.retrieve(assistant.id);
        console.log(`[OpenAI Provider] ========== VERIFICATION: RETRIEVED ASSISTANT FROM OPENAI ==========`);
        console.log(`[OpenAI Provider] Assistant ID: ${retrievedAssistant.id}`);
        console.log(`[OpenAI Provider] Assistant Name: ${retrievedAssistant.name}`);
        console.log(`[OpenAI Provider] Instructions Length: ${retrievedAssistant.instructions?.length || 0} chars`);
        console.log(`[OpenAI Provider] Instructions (as stored by OpenAI):`);
        console.log(retrievedAssistant.instructions || '(empty)');
        console.log(`[OpenAI Provider] Model: ${retrievedAssistant.model}`);
        console.log(`[OpenAI Provider] Tools Count: ${retrievedAssistant.tools?.length || 0}`);
        console.log(`[OpenAI Provider] ========== END VERIFICATION ==========`);
        
        // Compare sent vs stored
        if (retrievedAssistant.instructions !== request.instructions) {
          console.warn(`[OpenAI Provider] ⚠️ WARNING: Instructions mismatch!`);
          console.warn(`[OpenAI Provider] Sent length: ${request.instructions.length}, Stored length: ${retrievedAssistant.instructions?.length || 0}`);
          if (retrievedAssistant.instructions) {
            const sentPreview = request.instructions.substring(0, 200);
            const storedPreview = retrievedAssistant.instructions.substring(0, 200);
            console.warn(`[OpenAI Provider] Sent preview: ${sentPreview}...`);
            console.warn(`[OpenAI Provider] Stored preview: ${storedPreview}...`);
          }
        } else {
          console.log(`[OpenAI Provider] ✅ Instructions match perfectly!`);
        }
      } catch (verifyError: any) {
        console.error(`[OpenAI Provider] ⚠️ Failed to verify assistant: ${verifyError.message}`);
      }

      return {
        providerAgentId: assistant.id,
        metadata: {
          createdAt: assistant.created_at,
          object: assistant.object,
          description: assistant.description,
          toolCount: assistant.tools?.length || 0,
          verifiedInstructions: retrievedAssistant?.instructions || null,
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

  /**
   * Stream response from OpenAI (supports both Chat Completions and Assistants API)
   */
  async streamResponse(
    request: AiProviderRequest,
    onChunk: (chunk: string) => Promise<void>
  ): Promise<void> {
    this.validateRequest(request);

    try {
      if (request.assistantId && request.threadId) {
        // Use Assistants API with streaming
        await this.streamResponseWithAssistant(request, onChunk);
      } else {
        // Use Chat Completions API with streaming
        await this.streamResponseWithChatCompletions(request, onChunk);
      }
    } catch (error: any) {
      console.error('[OpenAI Provider] Streaming error:', error);
      throw error;
    }
  }

  private async streamResponseWithChatCompletions(
    request: AiProviderRequest,
    onChunk: (chunk: string) => Promise<void>
  ): Promise<void> {
    const userContent: any =
      request.imageUrls && request.imageUrls.length > 0
        ? [
            { type: 'text', text: request.message },
            ...request.imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
          ]
        : request.message;

    const stream = await this.client.chat.completions.create({
      model: request.modelName,
      messages: [
        { role: 'system', content: request.systemPrompt || 'You are a helpful assistant.' },
        { role: 'user', content: userContent },
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: true, // Enable streaming
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        await onChunk(content);
      }
    }
  }

  private async streamResponseWithAssistant(
    request: AiProviderRequest,
    onChunk: (chunk: string) => Promise<void>
  ): Promise<void> {
    if (!request.assistantId || !request.threadId) {
      throw new Error('Assistant ID and Thread ID are required for Assistants API streaming');
    }

    // Add message to thread
    const threadMessageContent: any =
      request.imageUrls && request.imageUrls.length > 0
        ? [
            { type: 'text', text: request.message },
            ...request.imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
          ]
        : request.message;

    await this.client.beta.threads.messages.create(request.threadId, {
      role: 'user',
      content: threadMessageContent,
    });

    // Create run with stream
    const stream = await this.client.beta.threads.runs.create(request.threadId, {
      assistant_id: request.assistantId,
      stream: true,
    });

    // Process stream events
    for await (const event of stream) {
      if (event.event === 'thread.message.delta') {
        const content = (event as any).data.delta.content?.[0]?.text?.value || '';
        if (content) {
          await onChunk(content);
        }
      } else if (event.event === 'thread.run.completed') {
        // Stream complete
        break;
      } else if (event.event === 'thread.run.failed') {
        const error = (event as any).data.last_error;
        throw new Error(`Assistant run failed: ${error?.message || 'Unknown error'}`);
      }
    }
  }
}

