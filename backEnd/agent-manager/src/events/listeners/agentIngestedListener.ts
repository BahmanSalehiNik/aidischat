import { Listener, Subjects, AgentIngestedEvent, EachMessagePayload } from '@aichatwar/shared';
import { AgentProfile } from '../../models/agent-profile';
import { Agent } from '../../models/agent';

export class AgentIngestedListener extends Listener<AgentIngestedEvent> {
  readonly topic = Subjects.AgentIngested;
  readonly groupId = 'agent-manager-agent-ingested';

  async onMessage(data: AgentIngestedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[AgentIngestedListener] Agent ingested event received: ${data.agentId}`);

    try {
      // Update or create AgentProfile from character data
      if (data.character) {
        const existingProfile = await AgentProfile.findById(data.agentId);
        
        if (existingProfile) {
          // Update existing profile
          Object.assign(existingProfile, {
            name: data.character.name || existingProfile.name,
            displayName: data.character.displayName,
            title: data.character.title,
            age: data.character.age,
            ageRange: data.character.ageRange,
            gender: data.character.gender,
            nationality: data.character.nationality,
            ethnicity: data.character.ethnicity,
            breed: data.character.breed,
            subtype: data.character.subtype,
            height: data.character.height,
            build: data.character.build,
            hairColor: data.character.hairColor,
            eyeColor: data.character.eyeColor,
            skinTone: data.character.skinTone,
            distinguishingFeatures: data.character.distinguishingFeatures,
            profession: data.character.profession,
            role: data.character.role,
            specialization: data.character.specialization,
            organization: data.character.organization,
            personality: data.character.personality,
            communicationStyle: data.character.communicationStyle,
            speechPattern: data.character.speechPattern,
            backstory: data.character.backstory,
            origin: data.character.origin,
            currentLocation: data.character.currentLocation,
            goals: data.character.goals,
            fears: data.character.fears,
            interests: data.character.interests,
            abilities: data.character.abilities,
            skills: data.character.skills,
            limitations: data.character.limitations,
            relationshipToUser: data.character.relationshipToUser,
          });
          await existingProfile.save();
          console.log(`[AgentIngestedListener] Updated agent profile: ${data.agentId}`);
        } else {
          // Create new profile
          const profile = AgentProfile.build({
            id: data.agentId,
            name: data.character.name || 'Unnamed Agent',
            displayName: data.character.displayName,
            title: data.character.title,
            age: data.character.age,
            ageRange: data.character.ageRange,
            gender: data.character.gender,
            nationality: data.character.nationality,
            ethnicity: data.character.ethnicity,
            breed: data.character.breed,
            subtype: data.character.subtype,
            height: data.character.height,
            build: data.character.build,
            hairColor: data.character.hairColor,
            eyeColor: data.character.eyeColor,
            skinTone: data.character.skinTone,
            distinguishingFeatures: data.character.distinguishingFeatures,
            profession: data.character.profession,
            role: data.character.role,
            specialization: data.character.specialization,
            organization: data.character.organization,
            personality: data.character.personality,
            communicationStyle: data.character.communicationStyle,
            speechPattern: data.character.speechPattern,
            backstory: data.character.backstory,
            origin: data.character.origin,
            currentLocation: data.character.currentLocation,
            goals: data.character.goals,
            fears: data.character.fears,
            interests: data.character.interests,
            abilities: data.character.abilities,
            skills: data.character.skills,
            limitations: data.character.limitations,
            relationshipToUser: data.character.relationshipToUser,
            isPublic: false,
            isActive: true,
          });
          await profile.save();
          console.log(`[AgentIngestedListener] Created agent profile: ${data.agentId}`);
        }
      }

      // Update Agent model with profile data if agentProfileId is set
      const agent = await Agent.findById(data.agentId);
      if (agent && data.character) {
        // Link agent to profile if not already linked
        // The agentProfileId should come from the agents service, but we can infer it
        // For now, we'll just ensure the agent exists
      }

      await this.ack();
    } catch (error: any) {
      console.error(`[AgentIngestedListener] Error processing agent ingested event:`, error);
      throw error;
    }
  }
}

