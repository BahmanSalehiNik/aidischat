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
    // Always exclude the current user
    const excludeSet = new Set([userId]);

    // Get block list for this user
    const blockedUsers = await BlockList.find({ userId })
      .select('blockedUserId')
      .lean();
    blockedUsers.forEach((b) => excludeSet.add(b.blockedUserId));

    // Get non-suggestible users
    const nonSuggestibleUsers = await UserStatus.find({ isSuggestible: false })
      .select('userId')
      .lean();
    nonSuggestibleUsers.forEach((u) => excludeSet.add(u.userId));

    // Get non-suggestible profiles
    const nonSuggestibleProfiles = await ProfileStatus.find({ isSuggestible: false })
      .select('userId')
      .lean();
    nonSuggestibleProfiles.forEach((p) => excludeSet.add(p.userId));

    return excludeSet;
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
      // Define time window for "new users" to check if user should be labeled as "new" instead
      const newUserWindowDays = parseInt(process.env.NEW_USER_WINDOW_DAYS || '30', 10);
      const cutoffTime = Date.now() - newUserWindowDays * 24 * 60 * 60 * 1000;

      const popular = await PopularUser.find().sort({ score: -1 }).limit(10).lean();

      // Get userIds that need profile data
      const userIdsNeedingData = popular
        .filter((p) => !excludeSet.has(p.userId) && (!p.username || !p.fullName))
        .map((p) => p.userId);

      // Fetch missing profile data from NewUser projection
      let profileDataMap = new Map<string, { username?: string; fullName?: string; createdAtMs?: number }>();
      if (userIdsNeedingData.length > 0) {
        const newUsers = await NewUser.find({ userId: { $in: userIdsNeedingData } })
          .select('userId username fullName createdAtMs')
          .lean();
        profileDataMap = new Map(
          newUsers.map((n) => [n.userId, { username: n.username, fullName: n.fullName, createdAtMs: n.createdAtMs }])
        );
      }

      popular
        .filter((p) => !excludeSet.has(p.userId))
        .forEach((p) => {
          const fallbackData = profileDataMap.get(p.userId);
          const isNewUser = fallbackData?.createdAtMs && fallbackData.createdAtMs >= cutoffTime;
          
          // If user is within new user window and has low score, label as "new" instead of "popular"
          const shouldLabelAsNew = isNewUser && p.score < 5; // Low activity threshold
          
          suggestions.push({
            userId: p.userId,
            reason: shouldLabelAsNew ? 'new' : 'popular',
            username: p.username || fallbackData?.username,
            fullName: p.fullName || fallbackData?.fullName,
            profilePicture: p.profilePicture,
          });
        });
    }

    if (suggestions.length < 20 && options.includeNewUsers) {
      const already = new Set(suggestions.map((s) => s.userId));
      const needed = 20 - suggestions.length;
      if (needed > 0) {
        // Define time window for "new users" (default: 30 days)
        const newUserWindowDays = parseInt(process.env.NEW_USER_WINDOW_DAYS || '30', 10);
        const cutoffTime = Date.now() - newUserWindowDays * 24 * 60 * 60 * 1000;

        // Fetch extra to account for filtering, only users within the time window
        const newUsers = await NewUser.find({
          createdAtMs: { $gte: cutoffTime },
        })
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

