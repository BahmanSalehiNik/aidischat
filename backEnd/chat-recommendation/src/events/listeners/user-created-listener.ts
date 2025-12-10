import { Listener, Subjects, UserCreatedEvent, EachMessagePayload } from '@aichatwar/shared';
import { featureStore } from '../../services/feature-store';

/**
 * UserCreatedListener
 * 
 * Initializes user feature projections from UserCreatedEvent
 */
export class UserCreatedListener extends Listener<UserCreatedEvent> {
  readonly topic = Subjects.UserCreated;
  readonly groupId = 'recommendation-user-created';

  async onMessage(data: UserCreatedEvent['data'], payload: EachMessagePayload) {
    const { id } = data;

    console.log(`[UserCreatedListener] Initializing user features for ${id}`);

    try {
      // Initialize user features with defaults
      await featureStore.updateUserFeatures(id, {
        userId: id,
        interests: [],
        preferredAgents: [],
        interactionHistory: [],
        preferences: {
          domains: [],
          topics: [],
        },
        language: 'en', // Default language
      });

      console.log(`[UserCreatedListener] ✅ Initialized user features for ${id}`);
    } catch (error: any) {
      console.error(`[UserCreatedListener] ❌ Error initializing user features for ${id}:`, error);
      // Don't throw - user features can be created lazily
    }

    await this.ack();
  }
}

