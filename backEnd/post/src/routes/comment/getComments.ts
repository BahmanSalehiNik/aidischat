import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, NotFoundError } from '@aichatwar/shared';
import { Post } from '../../models/post';
import { Comment } from '../../models/comment';
import { Profile } from '../../models/user/profile';
import { User } from '../../models/user/user';
import { Reaction } from '../../models/reaction';

const router = express.Router();

router.get(
  '/api/posts/:postId/comments',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const currentUserId = req.jwtPayload!.id;
    
    // Check if post exists
    const post = await Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post) {
      throw new NotFoundError();
    }

    // Get query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const parentCommentId = req.query.parentCommentId as string;

    // Build query
    const query: any = {
      postId: req.params.postId,
      isDeleted: false
    };

    // If parentCommentId is provided, get replies to that comment
    // If not provided, get top-level comments (no parent)
    if (parentCommentId) {
      query.parentCommentId = parentCommentId;
    } else {
      query.parentCommentId = { $exists: false };
    }

    // Get comments with pagination
    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await Comment.countDocuments(query);

    // Fetch profile and user information for all comment authors
    const userIds = Array.from(new Set(comments.map((c: any) => c.userId)));
    const [profiles, users] = await Promise.all([
      Profile.find({ userId: { $in: userIds } })
        .select('userId username avatarUrl')
        .lean(),
      User.find({ _id: { $in: userIds } })
        .select('_id email')
        .lean(),
    ]);

    const profileMap = new Map(profiles.map((p: any) => [p.userId, p]));
    const userMap = new Map(users.map((u: any) => {
      const id = typeof u._id === 'string' ? u._id : u._id.toString();
      return [id, u];
    }));

    // Fetch reactions for all comments
    const commentIds = comments.map((c: any) => c._id?.toString() || c.id);
    const allReactions = await Reaction.find({ 
      commentId: { $in: commentIds }
    }).lean();

    // Group reactions by commentId
    const reactionsByComment = new Map<string, any[]>();
    allReactions.forEach((r: any) => {
      const commentId = r.commentId?.toString();
      if (commentId) {
        if (!reactionsByComment.has(commentId)) {
          reactionsByComment.set(commentId, []);
        }
        reactionsByComment.get(commentId)!.push(r);
      }
    });

    // Enrich comments with author information and reactions
    const enrichedComments = comments.map((comment: any) => {
      const commentUserId = comment.userId?.toString();
      const profile = profileMap.get(commentUserId);
      const user = userMap.get(commentUserId);
      
      // Determine display name
      let displayName: string | undefined;
      if (profile?.username) {
        displayName = profile.username;
      } else if (user?.email) {
        displayName = user.email.split('@')[0];
      }
      
      if (!displayName) {
        if (commentUserId === currentUserId) {
          displayName = 'You';
        } else if (commentUserId) {
          displayName = `User ${commentUserId.slice(0, 8)}`;
        } else {
          displayName = 'User';
        }
      }

      // Get reactions for this comment
      const commentId = comment._id?.toString() || comment.id;
      const commentReactions = reactionsByComment.get(commentId) || [];
      
      // Aggregate reactions by type
      const reactionMap = new Map<string, number>();
      commentReactions.forEach((r: any) => {
        const type = r.type || 'like';
        reactionMap.set(type, (reactionMap.get(type) || 0) + 1);
      });

      const reactionsSummary = Array.from(reactionMap.entries()).map(([type, count]) => ({
        type,
        count,
      }));

      // Get current user's reaction
      const userReaction = commentReactions.find((r: any) => r.userId === currentUserId);
      const currentUserReaction = userReaction ? { userId: userReaction.userId, type: userReaction.type } : undefined;

      return {
        ...comment,
        author: {
          userId: comment.userId,
          name: displayName,
          email: user?.email,
          avatarUrl: profile?.avatarUrl,
        },
        reactions: reactionsSummary,
        currentUserReaction,
      };
    });

    res.send({
      comments: enrichedComments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  }
);

export { router as getCommentsRouter };
