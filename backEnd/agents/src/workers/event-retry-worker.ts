/**
 * Event Retry Worker
 * 
 * Periodically scans for agents with status=Pending and eventPublishedAt=null,
 * and retries publishing the agent.ingested event.
 * 
 * This ensures agents created during Kafka outages are eventually processed.
 * Compatible with outbox pattern - both can coexist safely using eventPublishedAt flag.
 */

import cron from 'node-cron';
import { Agent, AgentProvisioningStatus } from '../models/agent';
import { AgentProfile } from '../models/agentProfile';
import { AgentIngestedPublisher } from '../events/agentPublishers';
import { kafkaWrapper } from '../kafka-client';

// Configuration
const RETRY_INTERVAL_CRON = process.env.AGENT_EVENT_RETRY_INTERVAL_CRON || '*/5 * * * *'; // Default: every 5 minutes
const TEST_RETRY_INTERVAL_CRON = process.env.TEST_AGENT_EVENT_RETRY_INTERVAL_CRON || '*/30 * * * * *'; // Default: every 30 seconds for testing
const USE_TEST_INTERVAL = process.env.USE_TEST_AGENT_EVENT_RETRY_INTERVAL === 'true';
const MAX_AGE_HOURS = parseInt(process.env.AGENT_EVENT_RETRY_MAX_AGE_HOURS || '24', 10); // Only retry agents created in last 24h

class EventRetryWorker {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private isRunning: boolean = false;

  /**
   * Build event data for agent.ingested event
   */
  private buildEventData(agent: any, agentProfile: any) {
    return {
      id: agent.id,
      agentId: agent.id,
      ownerUserId: agent.ownerUserId,
      version: agent.version,
      correlationId: agent.provisioningCorrelationId || '',
      profile: {
        modelProvider: agent.modelProvider,
        modelName: agent.modelName,
        systemPrompt: agent.systemPrompt,
        tools: agent.tools || [],
        rateLimits: agent.rateLimits,
        voiceId: agent.voiceId || '',
        memory: agent.memory || {},
        privacy: agent.privacy,
      },
      character: (() => {
        if (!agentProfile) return {};
        
        const char: any = { name: agentProfile.name };
        if (agentProfile.displayName) char.displayName = agentProfile.displayName;
        if (agentProfile.title) char.title = agentProfile.title;
        if (agentProfile.age !== undefined && agentProfile.age !== null) char.age = agentProfile.age;
        if (agentProfile.ageRange) char.ageRange = agentProfile.ageRange;
        if (agentProfile.gender) char.gender = agentProfile.gender;
        if (agentProfile.nationality) char.nationality = agentProfile.nationality;
        if (agentProfile.ethnicity) char.ethnicity = agentProfile.ethnicity;
        if (agentProfile.breed) char.breed = agentProfile.breed;
        if (agentProfile.subtype) char.subtype = agentProfile.subtype;
        if (agentProfile.height) char.height = agentProfile.height;
        if (agentProfile.build) char.build = agentProfile.build;
        if (agentProfile.hairColor) char.hairColor = agentProfile.hairColor;
        if (agentProfile.eyeColor) char.eyeColor = agentProfile.eyeColor;
        if (agentProfile.skinTone) char.skinTone = agentProfile.skinTone;
        if (agentProfile.distinguishingFeatures?.length > 0) {
          char.distinguishingFeatures = agentProfile.distinguishingFeatures;
        }
        if (agentProfile.profession) char.profession = agentProfile.profession;
        if (agentProfile.role) char.role = agentProfile.role;
        if (agentProfile.specialization) char.specialization = agentProfile.specialization;
        if (agentProfile.organization) char.organization = agentProfile.organization;
        if (agentProfile.personality?.length > 0) char.personality = agentProfile.personality;
        if (agentProfile.communicationStyle) char.communicationStyle = agentProfile.communicationStyle;
        if (agentProfile.speechPattern) char.speechPattern = agentProfile.speechPattern;
        if (agentProfile.backstory) char.backstory = agentProfile.backstory;
        if (agentProfile.origin) char.origin = agentProfile.origin;
        if (agentProfile.currentLocation) char.currentLocation = agentProfile.currentLocation;
        if (agentProfile.goals?.length > 0) char.goals = agentProfile.goals;
        if (agentProfile.fears?.length > 0) char.fears = agentProfile.fears;
        if (agentProfile.interests?.length > 0) char.interests = agentProfile.interests;
        if (agentProfile.abilities?.length > 0) char.abilities = agentProfile.abilities;
        if (agentProfile.skills?.length > 0) char.skills = agentProfile.skills;
        if (agentProfile.limitations?.length > 0) char.limitations = agentProfile.limitations;
        if (agentProfile.relationshipToUser) char.relationshipToUser = agentProfile.relationshipToUser;
        
        return char;
      })(),
      metadata: {
        correlationId: agent.provisioningCorrelationId || '',
        requestedAt: agent.createdAt?.toISOString() || new Date().toISOString(),
        requesterUserId: agent.ownerUserId,
      },
      ingestedAt: agent.createdAt?.toISOString() || new Date().toISOString(),
    };
  }

  /**
   * Retry publishing event for a single agent
   */
  private async retryPublishEvent(agent: any): Promise<boolean> {
    try {
      // Fetch agent profile if available
      let agentProfile = null;
      if (agent.agentProfileId) {
        agentProfile = await AgentProfile.findById(agent.agentProfileId);
      }

      const eventData = this.buildEventData(agent, agentProfile);

      // Ensure producer is connected before publishing
      await kafkaWrapper.ensureProducerConnected();
      
      // Attempt to publish
      await new AgentIngestedPublisher(kafkaWrapper.producer).publish(eventData);

      // Mark as published
      agent.eventPublishedAt = new Date();
      await agent.save();

      console.log(`[EventRetryWorker] ✅ Successfully published agent.ingested event for agent ${agent.id}`);
      return true;
    } catch (error: any) {
      console.error(`[EventRetryWorker] ❌ Failed to publish agent.ingested event for agent ${agent.id}:`, error.message || error);
      return false;
    }
  }

  /**
   * Process pending agents that haven't had their events published
   */
  private async processPendingAgents(): Promise<void> {
    try {
      const maxAge = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);

      // Find agents that:
      // 1. Are in Pending status
      // 2. Haven't had their event published yet
      // 3. Were created in the last MAX_AGE_HOURS (to avoid retrying very old agents)
      const pendingAgents = await Agent.find({
        status: AgentProvisioningStatus.Pending,
        eventPublishedAt: null,
        createdAt: { $gte: maxAge },
        isDeleted: false,
      }).limit(50); // Process in batches

      if (pendingAgents.length === 0) {
        return;
      }

      console.log(`[EventRetryWorker] Found ${pendingAgents.length} agents with unpublished events, retrying...`);

      // Process with concurrency limit
      const concurrencyLimit = 5;
      for (let i = 0; i < pendingAgents.length; i += concurrencyLimit) {
        const batch = pendingAgents.slice(i, i + concurrencyLimit);
        await Promise.all(batch.map(agent => this.retryPublishEvent(agent)));
      }

      const successCount = pendingAgents.filter(a => a.eventPublishedAt !== null).length;
      console.log(`[EventRetryWorker] ✅ Processed ${pendingAgents.length} agents, ${successCount} successful`);
    } catch (error: any) {
      console.error('[EventRetryWorker] ❌ Error processing pending agents:', error);
    }
  }

  /**
   * Start the background worker
   */
  start(): void {
    if (this.task) {
      console.log('[EventRetryWorker] Already running');
      return;
    }

    const enabled = process.env.AGENT_EVENT_RETRY_ENABLED !== 'false';
    if (!enabled) {
      console.log('[EventRetryWorker] Disabled via AGENT_EVENT_RETRY_ENABLED');
      return;
    }

    // Use test interval if enabled, otherwise use production interval
    const cronExpression = USE_TEST_INTERVAL ? TEST_RETRY_INTERVAL_CRON : RETRY_INTERVAL_CRON;
    const intervalDescription = USE_TEST_INTERVAL ? '30 seconds (TEST MODE)' : '5 minutes';

    console.log(`[EventRetryWorker] Scheduling event retries with interval: ${intervalDescription} (cron: ${cronExpression})`);

    this.task = cron.schedule(cronExpression, async () => {
      console.log(`[EventRetryWorker] Starting scheduled event retry (${new Date().toISOString()})`);
      await this.processPendingAgents();
    });

    this.isRunning = true;
    console.log(`[EventRetryWorker] ✅ Background worker started (runs every ${intervalDescription})`);
  }

  /**
   * Stop the background worker
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.isRunning = false;
    console.log('[EventRetryWorker] Background worker stopped');
  }
}

export const eventRetryWorker = new EventRetryWorker();

