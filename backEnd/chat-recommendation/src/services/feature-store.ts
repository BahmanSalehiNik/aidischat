import { AgentFeature } from '../models/agent-feature';
import { UserFeature } from '../models/user-feature';
import { FEATURE_STORE_CONFIG, OPEN_QUESTIONS_CONFIG } from '../config/constants';

import { AgentProvisioningStatus } from '../models/agent-feature';

export interface AgentFeatures {
  agentId: string;
  name: string;
  displayName?: string;
  tags: string[];
  skills: string[];
  specialization?: string;
  profession?: string;
  popularity: number;
  rating: number;
  embeddings?: number[];
  isActive: boolean; // Deprecated: Use provisioningStatus
  provisioningStatus: AgentProvisioningStatus; // NEW: Actual provisioning status
  isPublic: boolean;
  language?: string;
}

export interface UserFeatures {
  userId: string;
  interests: string[];
  preferredAgents: string[];
  interactionHistory: Array<{
    agentId: string;
    interactionCount: number;
    lastInteractionAt: Date;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  embeddings?: number[];
  preferences: {
    domains: string[];
    topics: string[];
  };
  language?: string;
}

// In-memory cache for features
const agentFeatureCache = new Map<string, { data: AgentFeatures; timestamp: number }>();
const userFeatureCache = new Map<string, { data: UserFeatures; timestamp: number }>();

export class FeatureStore {
  /**
   * Get user features (with caching if enabled)
   */
  async getUserFeatures(userId: string): Promise<UserFeatures | null> {
    // Check cache first
    if (OPEN_QUESTIONS_CONFIG.CACHE_USER_FEATURES) {
      const cached = userFeatureCache.get(userId);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < FEATURE_STORE_CONFIG.CACHE_TTL_SECONDS * 1000) {
          return cached.data;
        }
        userFeatureCache.delete(userId);
      }
    }

    // Fetch from database
    const userFeature = await UserFeature.findOne({ userId });
    if (!userFeature) {
      return null;
    }

    const features: UserFeatures = {
      userId: userFeature.userId,
      interests: userFeature.interests,
      preferredAgents: userFeature.preferredAgents,
      interactionHistory: userFeature.interactionHistory,
      embeddings: userFeature.embeddings,
      preferences: userFeature.preferences,
      language: userFeature.language,
    };

    // Cache if enabled
    if (OPEN_QUESTIONS_CONFIG.CACHE_USER_FEATURES) {
      userFeatureCache.set(userId, {
        data: features,
        timestamp: Date.now(),
      });
    }

    return features;
  }

  /**
   * Get agent features (with caching if enabled)
   */
  async getAgentFeatures(agentId: string): Promise<AgentFeatures | null> {
    // Check cache first
    if (OPEN_QUESTIONS_CONFIG.CACHE_AGENT_FEATURES) {
      const cached = agentFeatureCache.get(agentId);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < FEATURE_STORE_CONFIG.CACHE_TTL_SECONDS * 1000) {
          return cached.data;
        }
        agentFeatureCache.delete(agentId);
      }
    }

    // Fetch from database
    const agentFeature = await AgentFeature.findOne({ agentId });
    if (!agentFeature) {
      return null;
    }

    const features: AgentFeatures = {
      agentId: agentFeature.agentId,
      name: agentFeature.name,
      displayName: agentFeature.displayName,
      tags: agentFeature.tags,
      skills: agentFeature.skills,
      specialization: agentFeature.specialization,
      profession: agentFeature.profession,
      popularity: agentFeature.popularity,
      rating: agentFeature.rating,
      embeddings: agentFeature.embeddings,
      isActive: agentFeature.isActive, // Deprecated
      provisioningStatus: agentFeature.provisioningStatus || AgentProvisioningStatus.Pending,
      isPublic: agentFeature.isPublic,
      language: agentFeature.language,
    };

    // Cache if enabled
    if (OPEN_QUESTIONS_CONFIG.CACHE_AGENT_FEATURES) {
      agentFeatureCache.set(agentId, {
        data: features,
        timestamp: Date.now(),
      });
    }

    return features;
  }

  /**
   * Get multiple agent features in batch
   */
  async getAgentFeaturesBatch(agentIds: string[]): Promise<Map<string, AgentFeatures>> {
    const result = new Map<string, AgentFeatures>();
    const uncachedIds: string[] = [];

    // Check cache for each agent
    for (const agentId of agentIds) {
      if (OPEN_QUESTIONS_CONFIG.CACHE_AGENT_FEATURES) {
        const cached = agentFeatureCache.get(agentId);
        if (cached) {
          const age = Date.now() - cached.timestamp;
          if (age < FEATURE_STORE_CONFIG.CACHE_TTL_SECONDS * 1000) {
            result.set(agentId, cached.data);
            continue;
          }
          agentFeatureCache.delete(agentId);
        }
      }
      uncachedIds.push(agentId);
    }

    // Fetch uncached agents from database
    if (uncachedIds.length > 0) {
      const agentFeatures = await AgentFeature.find({
        agentId: { $in: uncachedIds },
      });

      for (const agentFeature of agentFeatures) {
        const features: AgentFeatures = {
          agentId: agentFeature.agentId,
          name: agentFeature.name,
          displayName: agentFeature.displayName,
          tags: agentFeature.tags,
          skills: agentFeature.skills,
          specialization: agentFeature.specialization,
          profession: agentFeature.profession,
          popularity: agentFeature.popularity,
          rating: agentFeature.rating,
          embeddings: agentFeature.embeddings,
          isActive: agentFeature.isActive, // Deprecated
          provisioningStatus: agentFeature.provisioningStatus || AgentProvisioningStatus.Pending,
          isPublic: agentFeature.isPublic,
          language: agentFeature.language,
        };

        result.set(agentFeature.agentId, features);

        // Cache if enabled
        if (OPEN_QUESTIONS_CONFIG.CACHE_AGENT_FEATURES) {
          agentFeatureCache.set(agentFeature.agentId, {
            data: features,
            timestamp: Date.now(),
          });
        }
      }
    }

    return result;
  }

  /**
   * Update user features (called from event listeners)
   */
  async updateUserFeatures(userId: string, updates: Partial<UserFeatures>): Promise<void> {
    await UserFeature.findOneAndUpdate(
      { userId },
      { 
        ...updates,
        lastUpdatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Invalidate cache
    if (OPEN_QUESTIONS_CONFIG.CACHE_USER_FEATURES) {
      userFeatureCache.delete(userId);
    }
  }

  /**
   * Update agent features (called from event listeners)
   */
  async updateAgentFeatures(agentId: string, updates: Partial<AgentFeatures>): Promise<void> {
    await AgentFeature.findOneAndUpdate(
      { agentId },
      { 
        ...updates,
        lastUpdatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Invalidate cache
    if (OPEN_QUESTIONS_CONFIG.CACHE_AGENT_FEATURES) {
      agentFeatureCache.delete(agentId);
    }
  }
}

export const featureStore = new FeatureStore();

