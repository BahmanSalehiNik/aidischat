import { Listener, AgentCreationReplySuccessEvent, AgentCreationReplyFailedEvent, Subjects } from "@aichatwar/shared";
import { EachMessagePayload } from "kafkajs";
import { Agent, AgentProvisioningStatus } from "../../models/agent";
import { AgentCreatedPublisher, AgentCreationFailedPublisher } from "../agentPublishers";
import { kafkaWrapper } from "../../kafka-client";
import { GroupIdAgentCreationReplySuccess, GroupIdAgentCreationReplyFailed } from "./queGroupNames";

export class AgentCreationReplySuccessListener extends Listener<AgentCreationReplySuccessEvent> {
  readonly topic = Subjects.AgentCreationReplySuccess;
  readonly groupId = GroupIdAgentCreationReplySuccess;

  async onMessage(data: AgentCreationReplySuccessEvent["data"], _payload: EachMessagePayload): Promise<void> {
    const { agentId, provider, providerAgentId, correlationId, provisionedAt, metadata } = data;
    console.log(`[AgentCreationReplySuccessListener] Received event for agent ${agentId}, correlationId: ${correlationId}`);
    const agent = await Agent.findById(agentId);

    if (!agent) {
      console.warn(`[AgentCreationReplySuccessListener] Agent ${agentId} not found. Skipping.`);
      await this.ack();
      return;
    }

    if (agent.provisioningCorrelationId && agent.provisioningCorrelationId !== correlationId) {
      console.warn(
        `[AgentCreationReplySuccessListener] Correlation mismatch for agent ${agentId}. Expected ${agent.provisioningCorrelationId}, received ${correlationId}. Ignoring event.`
      );
      await this.ack();
      return;
    }

    agent.status = AgentProvisioningStatus.Active;
    agent.provider = provider;
    agent.providerAgentId = providerAgentId;
    agent.provisionedAt = provisionedAt ? new Date(provisionedAt) : new Date();
    agent.provisioningCorrelationId = correlationId;
    agent.provisioningError = null;
    agent.lastProvisioningFailedAt = undefined;
    agent.version += 1;

    await agent.save();
    console.log(`[AgentCreationReplySuccessListener] Agent ${agentId} updated to Active status, publishing agent.created event`);

    await new AgentCreatedPublisher(kafkaWrapper.producer).publish({
      id: agent.id,
      ownerUserId: agent.ownerUserId,
      version: agent.version,
      provider,
      providerAgentId,
      correlationId,
      metadata,
    });
    console.log(`[AgentCreationReplySuccessListener] Published agent.created event for agent ${agentId}`);

    await this.ack();
  }
}

export class AgentCreationReplyFailedListener extends Listener<AgentCreationReplyFailedEvent> {
  readonly topic = Subjects.AgentCreationReplyFailed;
  readonly groupId = GroupIdAgentCreationReplyFailed;

  async onMessage(data: AgentCreationReplyFailedEvent["data"], _payload: EachMessagePayload): Promise<void> {
    const { agentId, errorMessage, provider, correlationId, failedAt, metadata, retryable, errorCode } = data;
    const agent = await Agent.findById(agentId);

    if (!agent) {
      console.warn(`[AgentCreationReplyFailedListener] Agent ${agentId} not found. Skipping.`);
      await this.ack();
      return;
    }

    if (agent.provisioningCorrelationId && agent.provisioningCorrelationId !== correlationId) {
      console.warn(
        `[AgentCreationReplyFailedListener] Correlation mismatch for agent ${agentId}. Expected ${agent.provisioningCorrelationId}, received ${correlationId}. Ignoring event.`
      );
      await this.ack();
      return;
    }

    agent.status = AgentProvisioningStatus.Failed;
    agent.provisioningError = errorMessage;
    agent.provider = provider ?? agent.provider;
    agent.lastProvisioningFailedAt = failedAt ? new Date(failedAt) : new Date();
    agent.version += 1;

    await agent.save();

    await new AgentCreationFailedPublisher(kafkaWrapper.producer).publish({
      id: agent.id,
      agentId: agent.id,
      ownerUserId: agent.ownerUserId,
      version: agent.version,
      provider: agent.provider,
      providerAgentId: agent.providerAgentId,
      reason: errorMessage,
      correlationId,
      failedAt: (failedAt ? new Date(failedAt) : new Date()).toISOString(),
      metadata: {
        ...metadata,
        retryable,
        errorCode,
      },
    });

    await this.ack();
  }
}

