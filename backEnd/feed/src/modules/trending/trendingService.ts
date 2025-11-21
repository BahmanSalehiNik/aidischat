import { Post } from '../../models/post/post';
import { TrendingPost } from '../../models/trending/trendingPost';
import { UserStatus } from '../../models/user-status';
import { BlockList } from '../../models/block-list';

function computeRecencyBoost(date: Date): number {
  const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  return Math.max(0, 10 - hours);
}

function computeReactionCount(post: any): number {
  if (!post.reactionsSummary) return 0;
  return post.reactionsSummary.reduce((sum: number, reaction: any) => sum + (reaction?.count || 0), 0);
}

function computeTrendingScore(post: any): number {
  const likes = computeReactionCount(post);
  const comments = post.commentsCount || 0;
  const recency = computeRecencyBoost(post.createdAt || new Date());
  return likes * 2 + comments * 3 + recency;
}

async function refreshTrendingProjection(limit = 100) {
  // Get excluded user IDs (deleted/blocked/restricted)
  const nonSuggestibleUsers = await UserStatus.find({ isSuggestible: false })
    .select('userId')
    .lean();
  const excludeUserIds = nonSuggestibleUsers.map((u) => u.userId);

  const posts = await Post.find({
    visibility: 'public',
    userId: { $nin: excludeUserIds },
  })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  console.log(`[Trending] Found ${posts.length} public posts to evaluate`);

  const scored = posts
    .map((post) => ({
      postId: post._id!.toString(),
      authorId: post.userId,
      content: post.content,
      media: post.media,
      createdAt: post.createdAt || new Date(post.originalCreation),
      trendingScore: computeTrendingScore(post),
    }))
    .filter((post) => post.media && post.media.length > 0)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);

  console.log(`[Trending] After filtering for media, ${scored.length} posts remain`);

  if (!scored.length) {
    console.log('[Trending] No posts with media found, skipping trending update');
    return;
  }

  const bulk = scored.map((p) => ({
    updateOne: {
      filter: { postId: p.postId },
      update: { $set: p },
      upsert: true,
    },
  }));

  await TrendingPost.bulkWrite(bulk);
  console.log(`[Trending] Updated ${scored.length} trending posts`);
}

async function getTopPosts(limit: number, viewerUserId?: string) {
  let query: any = {};

  // If viewer is provided, filter by their block list
  if (viewerUserId) {
    const blockedUsers = await BlockList.find({ userId: viewerUserId })
      .select('blockedUserId')
      .lean();
    const blockedSet = new Set(blockedUsers.map((b) => b.blockedUserId));

    if (blockedSet.size > 0) {
      // Fetch extra posts to account for filtering
      const posts = await TrendingPost.find()
        .sort({ trendingScore: -1 })
        .limit(limit * 2)
        .lean();

      // Filter out posts from blocked users
      return posts.filter((p) => !blockedSet.has(p.authorId)).slice(0, limit);
    }
  }

  // No blocking or no viewer - return top posts
  return TrendingPost.find(query).sort({ trendingScore: -1 }).limit(limit).lean();
}

export const trendingService = {
  refreshNow: refreshTrendingProjection,
  getTopPosts,
};

