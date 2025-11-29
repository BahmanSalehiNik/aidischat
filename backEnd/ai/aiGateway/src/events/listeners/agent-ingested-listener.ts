import { Listener, AgentIngestedEvent, Subjects } from '@aichatwar/shared';
import { EachMessagePayload } from 'kafkajs';
import {
  AgentProfile,
  AgentProfileDoc,
  AgentProfileStatus,
} from '../../models/agent-profile';
import {
  AgentCreationReplyFailedPublisher,
  AgentCreationReplySuccessPublisher,
} from '../publishers/agent-provisioning-publishers';
import { kafkaWrapper } from '../../kafka-client';
import { ProviderFactory } from '../../providers/provider-factory';
import { AgentCreationRequest, AgentCreationResponse } from '../../providers/base-provider';
import { PromptBuilder, CharacterAttributes } from '../../prompt-engineering';

export class AgentIngestedListener extends Listener<AgentIngestedEvent> {
  readonly topic = Subjects.AgentIngested;
  readonly groupId = 'ai-gateway-agent-ingested';
  protected fromBeginning: boolean = true; // Read from beginning to catch missed events on restart

  async onMessage(data: AgentIngestedEvent['data'], _payload: EachMessagePayload): Promise<void> {
    const {
      agentId,
      ownerUserId,
      version,
      correlationId,
      profile,
      metadata,
      ingestedAt,
    } = data;

    console.log(`[AgentIngestedListener] ✅✅✅ Received agent.ingested event for agent ${agentId}, correlationId: ${correlationId}, provider: ${profile.modelProvider}`);
    console.log(`[AgentIngestedListener] Starting agent provisioning process for agent ${agentId}...`);

    const ingestedDate = new Date(ingestedAt);

    const projection = await AgentProfile.upsertFromIngestion({
      agentId,
      ownerUserId,
      version,
      correlationId,
      ingestedAt: ingestedDate,
      status: AgentProfileStatus.Pending,
      modelProvider: profile.modelProvider,
      modelName: profile.modelName,
      systemPrompt: profile.systemPrompt,
      tools: profile.tools ?? [],
      rateLimits: profile.rateLimits,
      voiceId: profile.voiceId,
      memory: profile.memory,
      privacy: profile.privacy,
      metadata: {
        ...metadata,
        character: data.character,
      },
    });

    try {
      console.log(`[AgentIngestedListener] Calling provisionAgent for agent ${agentId}...`);
      const provisionResult = await this.provisionAgent(projection);
      console.log(`[AgentIngestedListener] provisionAgent completed for agent ${agentId}, providerAgentId: ${provisionResult.providerAgentId}`);

      if (provisionResult.error) {
        // Provider returned an error response
        throw {
          message: provisionResult.error,
          retryable: provisionResult.retryable ?? false,
          metadata: provisionResult.metadata,
        };
      }

      projection.status = AgentProfileStatus.Active;
      projection.provider = projection.modelProvider;
      projection.providerAgentId = provisionResult.providerAgentId;
      projection.lastProvisioningError = null;
      
      console.log(`[AgentIngestedListener] Saving agent profile to database: agentId=${agentId}, status=${projection.status}, providerAgentId=${projection.providerAgentId}`);
      await projection.save();
      console.log(`[AgentIngestedListener] ✅ Agent profile saved successfully to database: agentId=${agentId}`);

      console.log(`[AgentIngestedListener] Agent ${agentId} provisioned successfully, publishing agent.creation.reply.success`);
      await new AgentCreationReplySuccessPublisher(kafkaWrapper.producer).publish({
        id: agentId,
        agentId,
        ownerUserId,
        version,
        correlationId,
        provider: projection.modelProvider,
        providerAgentId: provisionResult.providerAgentId,
        provisionedAt: new Date().toISOString(),
        metadata: {
          ...projection.metadata,
          provision: provisionResult.metadata,
        },
      });
      console.log(`[AgentIngestedListener] Published agent.creation.reply.success for agent ${agentId}`);
    } catch (error: any) {
      const failureMessage = error?.message || 'Failed to provision agent with provider';
      const retryable = error?.retryable ?? false;

      console.error(`[AgentIngestedListener] Failed to provision agent ${agentId}:`, failureMessage);
      projection.status = AgentProfileStatus.Failed;
      projection.lastProvisioningError = failureMessage;
      await projection.save();

      console.log(`[AgentIngestedListener] Publishing agent.creation.reply.failed for agent ${agentId}`);
      await new AgentCreationReplyFailedPublisher(kafkaWrapper.producer).publish({
        id: agentId,
        agentId,
        ownerUserId,
        version,
        correlationId,
        provider: projection.modelProvider,
        errorMessage: failureMessage,
        errorCode: error?.code || error?.metadata?.errorCode,
        retryable,
        metadata: {
          ...projection.metadata,
          provision: error?.metadata,
        },
        failedAt: new Date().toISOString(),
      });
    }

    await this.ack();
  }

  private async provisionAgent(profile: AgentProfileDoc): Promise<AgentCreationResponse> {
    // Get API key from profile or environment variables
    const apiKey = profile.apiKey || this.getApiKeyFromEnv(profile.modelProvider);
    const endpoint = profile.endpoint || this.getEndpointFromEnv(profile.modelProvider);

    if (
      !apiKey &&
      profile.modelProvider !== 'local' &&
      profile.modelProvider !== 'custom'
    ) {
      throw {
        message: `API key is required for ${profile.modelProvider} provider`,
        retryable: false,
        code: 'MISSING_API_KEY',
      };
    }

    if (!endpoint && (profile.modelProvider === 'local' || profile.modelProvider === 'custom')) {
      throw {
        message: `Endpoint is required for ${profile.modelProvider} provider`,
        retryable: false,
        code: 'MISSING_ENDPOINT',
      };
    }

    // Create provider instance
    let provider;
    try {
      provider = ProviderFactory.createProvider(profile.modelProvider, apiKey, endpoint);
    } catch (error: any) {
      throw {
        message: `Failed to create provider instance: ${error.message}`,
        retryable: false,
        code: 'PROVIDER_INIT_ERROR',
      };
    }

    // Extract character attributes from metadata
    const characterAttributes: CharacterAttributes | undefined = profile.metadata?.character;

    // Log character attributes for debugging
    if (characterAttributes) {
      console.log(`[Agent Provision] Character attributes for agent ${profile.agentId}:`, JSON.stringify(characterAttributes, null, 2));
    } else {
      console.warn(`[Agent Provision] No character attributes found for agent ${profile.agentId}`);
      console.warn(`[Agent Provision] Profile metadata:`, JSON.stringify(profile.metadata, null, 2));
    }

    // Build agent name from character or use agentId
    const agentName = characterAttributes?.name || 
                     characterAttributes?.displayName || 
                     `Agent ${profile.agentId.substring(0, 8)}`;

    // Build enhanced system prompt using prompt engineering
    // Include all character attributes that aren't supported in provider APIs
    let enhancedInstructions = PromptBuilder.buildSystemPrompt(
      profile.systemPrompt,
      characterAttributes,
      {
        includeAppearance: true,
        includePersonality: true,
        includeBackground: true,
        includeGoals: true,
        style: 'detailed', // Use detailed style for agent creation
      }
    );

    // If no character attributes and no base prompt, ensure we at least have the agent name
    if (!enhancedInstructions.trim() && agentName) {
      enhancedInstructions = `You are ${agentName}.`;
      console.log(`[Agent Provision] No character attributes or base prompt found, using minimal instructions with name: ${agentName}`);
    }

    console.log(`[Agent Provision] Enhanced instructions length: ${enhancedInstructions.length} characters`);
    if (enhancedInstructions.length > 0) {
      console.log(`[Agent Provision] Full instructions being sent to provider:`);
      console.log(`--- START INSTRUCTIONS ---`);
      console.log(enhancedInstructions);
      console.log(`--- END INSTRUCTIONS ---`);
    } else {
      console.warn(`[Agent Provision] WARNING: Enhanced instructions are empty!`);
    }

    // Prepare agent creation request
    const agentRequest: AgentCreationRequest = {
      name: agentName,
      instructions: enhancedInstructions,
      model: profile.modelName,
      tools: profile.tools,
      metadata: {
        agentId: profile.agentId,
        ownerUserId: profile.ownerUserId,
        correlationId: profile.correlationId,
      },
    };

    // Call provider's createAgent method
    return await provider.createAgent(agentRequest);
  }

  private getApiKeyFromEnv(provider: string): string | undefined {
    switch (provider.toLowerCase()) {
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY;
      case 'cohere':
        return process.env.COHERE_API_KEY;
      default:
        return undefined;
    }
  }

  private getEndpointFromEnv(provider: string): string | undefined {
    if (provider === 'local' || provider === 'custom') {
      return process.env.LOCAL_LLM_ENDPOINT;
    }
    return undefined;
  }
}

