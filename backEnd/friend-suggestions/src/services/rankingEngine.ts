import { PopularUser } from '../models/popular-user';
import { NewUser } from '../models/new-user';
import { MutualSuggestion } from '../models/mutual-suggestion';
import { BlockList } from '../models/block-list';
import { UserStatus } from '../models/user-status';
import { ProfileStatus } from '../models/profile-status';

export interface Suggestion {
  userId: string;
  reason: 'popular' | 'new' | 'mutual';
  mutualCount?: number;
  username?: string;
  fullName?: string;
  profilePicture?: string;
}

interface RankingOptions {
  includePopularUsers: boolean;
  includeNewUsers: boolean;
  includeMutuals: boolean;
}

class RankingEngine {
  /**
   * Get exclusion set for blocked and non-suggestible users
   */
  private async getExclusionSet(userId: string): Promise<Set<string>> {
    // Get block list for this user
    const blockedUsers = await BlockList.find({ userId })
      .select('blockedUserId')
      .lean();
    const blockedSet = new Set(blockedUsers.map((b) => b.blockedUserId));

    // Get non-suggestible users
    const nonSuggestibleUsers = await UserStatus.find({ isSuggestible: false })
      .select('userId')
      .lean();
    const nonSuggestibleSet = new Set(nonSuggestibleUsers.map((u) => u.userId));

    // Get non-suggestible profiles
    const nonSuggestibleProfiles = await ProfileStatus.find({ isSuggestible: false })
      .select('userId')
      .lean();
    nonSuggestibleProfiles.forEach((p) => nonSuggestibleSet.add(p.userId));

    // Combined exclusion set
    return new Set([...blockedSet, ...nonSuggestibleSet]);
  }

  async getSuggestions(
    userId: string,
    options: RankingOptions
  ): Promise<Suggestion[]> {
    // Get exclusion set (blocked + non-suggestible users)
    const excludeSet = await this.getExclusionSet(userId);

    const suggestions: Suggestion[] = [];

    if (options.includeMutuals) {
      const mutuals = await MutualSuggestion.find({ userId })
        .sort({ mutualCount: -1 })
        .limit(20)
        .lean();

      // Filter out blocked/non-suggestible users
      mutuals
        .filter((m) => !excludeSet.has(m.candidateId))
        .forEach((mutual) => {
          suggestions.push({
            userId: mutual.candidateId,
            reason: 'mutual',
            mutualCount: mutual.mutualCount,
            username: mutual.username,
            fullName: mutual.fullName,
            profilePicture: mutual.profilePicture,
          });
        });
    }

    if (suggestions.length === 0 && options.includePopularUsers) {
      const popular = await PopularUser.find().sort({ score: -1 }).limit(10).lean();

      popular
        .filter((p) => !excludeSet.has(p.userId))
        .forEach((p) => {
          suggestions.push({
            userId: p.userId,
            reason: 'popular',
            username: p.username,
            fullName: p.fullName,
            profilePicture: p.profilePicture,
          });
        });
    }

    if (suggestions.length < 20 && options.includeNewUsers) {
      const already = new Set(suggestions.map((s) => s.userId));
      const needed = 20 - suggestions.length;
      if (needed > 0) {
        // Fetch extra to account for filtering
        const newUsers = await NewUser.find()
          .sort({ createdAtMs: -1 })
          .limit(needed * 2)
          .lean();

        newUsers
          .filter((n) => !already.has(n.userId) && !excludeSet.has(n.userId))
          .slice(0, needed)
          .forEach((n) => {
            suggestions.push({
              userId: n.userId,
              reason: 'new',
              username: n.username,
              fullName: n.fullName,
            });
          });
      }
    }

    return suggestions;
  }
}

export const rankingEngine = new RankingEngine();

