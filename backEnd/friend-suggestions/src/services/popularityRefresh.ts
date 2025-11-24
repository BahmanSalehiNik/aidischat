import cron from 'node-cron';
import { UserSocialStats } from '../models/user-social-stats';
import { PopularUser } from '../models/popular-user';
import { NewUser } from '../models/new-user';

const DEFAULT_CRON = '*/5 * * * *';

async function rebuildPopularUsers() {
  console.log('[FriendSuggestions] Rebuilding popular users projection');
  const stats = await UserSocialStats.find().limit(500);

  // Define minimum score threshold for "popular" users (must have at least some activity)
  const MIN_POPULAR_SCORE = 1; // At least 1 follower or 2 profile views

  const updates = stats
    .map((s) => ({
      userId: s.userId,
      followersCount: s.followersCount ?? 0,
      profileViewsLast7d: s.profileViewsLast7d ?? 0,
      score: (s.followersCount ?? 0) * 2 + (s.profileViewsLast7d ?? 0) * 0.5,
    }))
    .filter((u) => u.score >= MIN_POPULAR_SCORE) // Only include users with meaningful activity
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  // Get existing PopularUser records to preserve profile data
  const existingUsers = await PopularUser.find({
    userId: { $in: updates.map((u) => u.userId) },
  }).lean();

  const existingDataMap = new Map(
    existingUsers.map((u) => [u.userId, { username: u.username, fullName: u.fullName, profilePicture: u.profilePicture }])
  );

  // Get username from NewUser projection as fallback (email-based username)
  const newUserData = await NewUser.find({
    userId: { $in: updates.map((u) => u.userId) },
  })
    .select('userId username fullName')
    .lean();

  const newUserDataMap = new Map(
    newUserData.map((n) => [n.userId, { username: n.username, fullName: n.fullName }])
  );

  const bulk = updates.map((u) => {
    const existing = existingDataMap.get(u.userId);
    const newUserData = newUserDataMap.get(u.userId);
    return {
      updateOne: {
        filter: { userId: u.userId },
        update: {
          $set: {
            ...u,
            // Preserve existing profile data if it exists, otherwise use NewUser data (email-based username)
            username: existing?.username || newUserData?.username || undefined,
            ...(existing?.fullName && { fullName: existing.fullName }),
            ...(existing?.profilePicture && { profilePicture: existing.profilePicture }),
          },
        },
        upsert: true,
      },
    };
  });

  if (bulk.length > 0) {
    await PopularUser.bulkWrite(bulk);
  }

  // Clean up: Remove users from PopularUser who no longer meet the minimum score threshold
  // This ensures new users with 0 followers/views don't stay labeled as "popular"
  // Note: Users we just updated will have scores >= MIN_POPULAR_SCORE, so they won't be deleted
  await PopularUser.deleteMany({
    score: { $lt: MIN_POPULAR_SCORE },
  });
}

class PopularityRefresh {
  private task: cron.ScheduledTask | null = null;

  start() {
    if (this.task) {
      return;
    }
    const cronExpr = process.env.POPULARITY_REFRESH_CRON || DEFAULT_CRON;
    this.task = cron.schedule(cronExpr, () => {
      rebuildPopularUsers().catch((err) => console.error('Popular refresh failed', err));
    });
    rebuildPopularUsers().catch((err) => console.error('Initial popular refresh failed', err));
  }
}

export const PopularityRefreshScheduler = new PopularityRefresh();

