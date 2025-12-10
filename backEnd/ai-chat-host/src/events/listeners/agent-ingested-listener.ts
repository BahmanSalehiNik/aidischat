import { Listener, Subjects, AgentIngestedEvent, EachMessagePayload } from '@aichatwar/shared';
import { AgentProjection } from '../../models/agent-projection';

/**
 * Listens to AgentIngestedEvent to build local agent projections
 * This allows agent matching without direct API calls
 */
export class AgentIngestedListener extends Listener<AgentIngestedEvent> {
  readonly topic = Subjects.AgentIngested;
  readonly groupId = 'ai-chat-host-agent-ingested';

  async onMessage(data: AgentIngestedEvent['data'], payload: EachMessagePayload) {
    const { id, agentId, character, profile } = data;

    console.log(`[AgentIngestedListener] Processing agent ${agentId || id}`);

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
      const personality = character?.personality || [];
      
      // Tags derived from other fields (character.tags doesn't exist in event type)
      const tags: string[] = [];
      if (specialization) tags.push(specialization);
      if (profession) tags.push(profession);
      if (title) tags.push(title);
      if (interests.length > 0) tags.push(...interests.slice(0, 5)); // Limit to avoid too many tags

      // Get ownerUserId from the event or profile
      const ownerUserId = data.ownerUserId || '';

      // Check if projection already exists
      let projection = await AgentProjection.findOne({ agentId: agentId || id });
      
      if (projection) {
        // Update existing projection
        projection.name = name;
        projection.displayName = displayName;
        projection.title = title;
        projection.profession = profession;
        projection.specialization = specialization;
        projection.interests = interests;
        projection.skills = skills;
        projection.tags = tags;
        projection.personality = personality;
        projection.isActive = true; // Assume active if ingested
        projection.isPublic = true; // Default to public (isPublic not in character type)
        projection.lastUpdatedAt = new Date();
        await projection.save();
        console.log(`[AgentIngestedListener] ✅ Updated agent projection for ${agentId || id}`);
      } else {
        // Create new projection
        const newProjection = AgentProjection.build({
          agentId: agentId || id,
          ownerUserId,
          name,
          displayName,
          title,
          profession,
          specialization,
          interests,
          skills,
          tags,
          personality,
          isActive: true,
          isPublic: true, // Default to public (isPublic not in character type)
          lastUpdatedAt: new Date(),
        });
        await newProjection.save();
        // Re-fetch to get the full document type
        projection = await AgentProjection.findOne({ agentId: agentId || id });
        console.log(`[AgentIngestedListener] ✅ Created agent projection for ${agentId || id}`);
      }

    } catch (error: any) {
      console.error(`[AgentIngestedListener] ❌ Error processing agent ${agentId || id}:`, error);
      throw error; // Re-throw to trigger retry
    }

    await this.ack();
  }
}

