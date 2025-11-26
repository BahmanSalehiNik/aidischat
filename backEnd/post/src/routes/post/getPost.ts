// routes/get-post.ts
import express, { Request, Response } from 'express';
import { Post, PostStatus } from '../../models/post';
import { Reaction } from '../../models/reaction';
import { canView } from '../../utils/visibilityCheck'
import { extractJWTPayload, loginRequired, Visibility } from '@aichatwar/shared';
import { Profile } from '../../models/user/profile';
import { User } from '../../models/user/user';

const router = express.Router();

router.get(
  '/api/posts/:id', 
  extractJWTPayload, 
  loginRequired,
  async (req: Request, res: Response) => {
  const currentUserId = req.jwtPayload!.id;
  const post = await Post.findById(req.params.id);
  if (!post || post.status != PostStatus.Active ) return res.status(404).send({ message: 'Not found' });

  const allowed = await canView(currentUserId, post.userId, post.visibility as Visibility);
  if (!allowed) return res.status(403).send({ message: 'Forbidden' });

  // Fetch reactions from Reaction collection
  const reactions = await Reaction.find({ postId: post.id, commentId: { $exists: false } }).lean();
  
  // Aggregate reactions by type
  const reactionMap = new Map<string, number>();
  reactions.forEach((r: any) => {
    const type = r.type || 'like';
    reactionMap.set(type, (reactionMap.get(type) || 0) + 1);
  });

  const reactionsSummary = Array.from(reactionMap.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  // Get current user's reaction
  const userReaction = reactions.find((r: any) => r.userId === currentUserId);
  const currentUserReaction = userReaction ? { userId: userReaction.userId, type: userReaction.type } : undefined;

  // Fetch author information
  const profile = await Profile.findOne({ userId: post.userId }).lean();
  const user = await User.findById(post.userId).select('email').lean();
  
  let displayName: string | undefined;
  if (profile?.username) {
    displayName = profile.username;
  } else if (user?.email) {
    displayName = user.email.split('@')[0];
  }
  
  if (!displayName) {
    if (post.userId === currentUserId) {
      displayName = 'You';
    } else if (post.userId) {
      displayName = `User ${post.userId.slice(0, 8)}`;
    } else {
      displayName = 'User';
    }
  }

  // Combine reactions from Post document (legacy) and Reaction collection
  // Prefer Reaction collection data
  const allReactions = reactions.map((r: any) => ({
    userId: r.userId,
    type: r.type,
  }));

  const response = {
    ...post.toJSON(),
    reactions: allReactions, // Include all reactions with userId for frontend
    reactionsSummary, // Include summary for easy display
    currentUserReaction, // Include current user's reaction
    author: {
      userId: post.userId,
      name: displayName,
      email: user?.email,
      avatarUrl: profile?.avatarUrl,
    },
  };

  res.send(response);
});

export { router as getPostRouter };
