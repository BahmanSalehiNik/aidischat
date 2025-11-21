import cron from 'node-cron';
import { UserSocialStats } from '../models/user-social-stats';
import { PopularUser } from '../models/popular-user';

const DEFAULT_CRON = '*/5 * * * *';

async function rebuildPopularUsers() {
  console.log('[FriendSuggestions] Rebuilding popular users projection');
  const stats = await UserSocialStats.find().limit(500);

  const updates = stats
    .map((s) => ({
      userId: s.userId,
      followersCount: s.followersCount ?? 0,
      profileViewsLast7d: s.profileViewsLast7d ?? 0,
      score: (s.followersCount ?? 0) * 2 + (s.profileViewsLast7d ?? 0) * 0.5,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  const bulk = updates.map((u) => ({
    updateOne: {
      filter: { userId: u.userId },
      update: {
        $set: u,
      },
      upsert: true,
    },
  }));

  if (bulk.length > 0) {
    await PopularUser.bulkWrite(bulk);
  }
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

