import { Listener, Subjects, AgentIngestedEvent, EachMessagePayload } from '@aichatwar/shared';
import { featureStore } from '../../services/feature-store';
import { AgentProvisioningStatus } from '../../models/agent-feature';

/**
 * AgentIngestedListener
 * 
 * Builds agent feature projections from AgentIngestedEvent
 * This populates the feature store used for recommendations
 */
export class AgentIngestedListener extends Listener<AgentIngestedEvent> {
  readonly topic = Subjects.AgentIngested;
  readonly groupId = 'recommendation-agent-ingested';

  async onMessage(data: AgentIngestedEvent['data'], payload: EachMessagePayload) {
    const { id, agentId, character, profile } = data;

    console.log(`[AgentIngestedListener] Processing agent ${agentId || id} for feature store`);

    try {
      // Extract character/profile data
      const name = character?.name || 'Unknown Agent';
      const displayName = character?.displayName;
      const title = character?.title;
      const profession = character?.profession;
      const specialization = character?.specialization;
      
      // Extract tags/interests from character data
      const interests = character?.interests || [];
      const skills = character?.skills || [];
      
      // Tags can be derived from other fields (character.tags doesn't exist in event)
      // We'll derive tags from specialization, profession, title, interests
      const tags: string[] = [];
      // Note: character.tags is not in AgentIngestedEvent interface
      // We derive tags from other fields
      if (specialization) tags.push(specialization);
      if (profession) tags.push(profession);
      if (title) tags.push(title);
      if (interests.length > 0) tags.push(...interests.slice(0, 5)); // Limit to avoid too many tags

      // Language from character (if available) - not in event, default to English
      const language = 'en'; // Default to English (language not in AgentIngestedEvent character)

      // Update agent features in feature store
      // IMPORTANT: Set provisioningStatus: Pending - agent is ingested but not yet provisioned
      // Agent will be marked Active when AgentCreatedEvent is received (after successful provisioning)
      await featureStore.updateAgentFeatures(agentId || id, {
        agentId: agentId || id,
        name,
        displayName,
        tags,
        skills,
        specialization,
        profession,
        popularity: 0, // Will be updated from interactions
        rating: 0, // Will be updated from feedback
        isActive: false, // Deprecated: Use provisioningStatus
        provisioningStatus: AgentProvisioningStatus.Pending, // CRITICAL: Not provisioned yet
        isPublic: true, // Default to true (isPublic not in AgentIngestedEvent character)
        language,
      });

      console.log(`[AgentIngestedListener] ✅ Updated agent features for ${agentId || id}`);
    } catch (error: any) {
      console.error(`[AgentIngestedListener] ❌ Error processing agent ${agentId || id}:`, error);
      throw error; // Re-throw to trigger retry
    }

    await this.ack();
  }
}

