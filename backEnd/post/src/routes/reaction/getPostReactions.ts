import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, Visibility } from '@aichatwar/shared';
import { Post, PostStatus } from '../../models/post';
import { Reaction } from '../../models/reaction';
import { Profile } from '../../models/user/profile';
import { User } from '../../models/user/user';
import { canView } from '../../utils/visibilityCheck';
import { ReadOnlyAzureStorageGateway } from '../../storage/azureStorageGateway';

const router = express.Router();

// Initialize read-only Azure Storage Gateway if credentials are available
let azureGateway: ReadOnlyAzureStorageGateway | null = null;
if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
  azureGateway = new ReadOnlyAzureStorageGateway(
    process.env.AZURE_STORAGE_ACCOUNT,
    process.env.AZURE_STORAGE_KEY
  );
}

async function signBlobUrlIfNeeded(url: string | undefined): Promise<string | undefined> {
  if (!url || typeof url !== 'string') return url;
  if (!azureGateway) return url;
  if (url.includes('?')) return url; // already signed
  const parsed = azureGateway.parseBlobUrl(url);
  if (!parsed) return url;
  try {
    return await azureGateway.generateDownloadUrl(parsed.container, parsed.blobName, 60 * 60 * 6);
  } catch {
    return url;
  }
}

/**
 * GET /api/posts/:postId/reactions
 * Query:
 *  - limit (default 50, max 200)
 *  - offset (default 0)
 *
 * Returns a list of users who reacted to the post, with their reaction type and signed avatar.
 */
router.get(
  '/api/posts/:postId/reactions',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const currentUserId = req.jwtPayload!.id;
    const postId = String(req.params.postId || '');
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const post = await Post.findById(postId).select('userId visibility status').lean();
    if (!post || post.status !== PostStatus.Active) {
      return res.status(404).send({ message: 'Not found' });
    }

    const allowed = await canView(currentUserId, String(post.userId), post.visibility as Visibility);
    if (!allowed) {
      return res.status(403).send({ message: 'Forbidden' });
    }

    const reactions = await Reaction.find({ postId, commentId: { $exists: false } })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const userIds = Array.from(new Set(reactions.map((r: any) => String(r.userId))));
    const [profiles, users] = await Promise.all([
      Profile.find({ userId: { $in: userIds } }).select('userId username avatarUrl').lean(),
      User.find({ _id: { $in: userIds } }).select('_id email isAgent displayName avatarUrl').lean(),
    ]);

    const profileMap = new Map(profiles.map((p: any) => [String(p.userId), p]));
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));

    const items = await Promise.all(
      reactions.map(async (r: any) => {
        const uid = String(r.userId);
        const p = profileMap.get(uid);
        const u = userMap.get(uid);
        const isAgent = Boolean((u as any)?.isAgent);

        let name: string | undefined = p?.username;
        if (!name && isAgent && (u as any)?.displayName) {
          name = String((u as any).displayName);
        }
        if (!name && u?.email) {
          name = u.email.split('@')[0];
        }
        if (!name) {
          name = isAgent ? `Agent ${uid.slice(0, 8)}` : `User ${uid.slice(0, 8)}`;
        }

        const rawAvatarUrl: string | undefined = isAgent ? (u as any)?.avatarUrl || p?.avatarUrl : p?.avatarUrl;
        const signedAvatarUrl = await signBlobUrlIfNeeded(rawAvatarUrl);

        return {
          id: String(r._id),
          type: r.type,
          createdAt: r.createdAt,
          user: {
            userId: uid,
            name,
            email: u?.email,
            avatarUrl: signedAvatarUrl,
            isAgent,
          },
        };
      })
    );

    res.send({ items, limit, offset, count: items.length });
  }
);

export { router as getPostReactionsRouter };


