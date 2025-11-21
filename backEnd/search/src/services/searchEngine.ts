import { UserSearch } from '../models/user-search';
import { PostSearch } from '../models/post-search';
import { AgentSearch } from '../models/agent-search';
import { PageSearch } from '../models/page-search';
import { BlockList } from '../models/block-list';
import { UserStatus } from '../models/user-status';
import { PostAuthorStatus } from '../models/post-author-status';

export type SearchType = 'users' | 'posts' | 'agents' | 'pages';

export interface SearchResult {
  id: string;
  type: SearchType;
  title: string;
  subtitle?: string;
  snippet?: string;
  avatarUrl?: string;
  score?: number;
}

interface SearchRequest {
  query: string;
  types: SearchType[];
  limit: number;
}

class SearchEngine {
  /**
   * Get exclusion set for blocked and non-suggestible users
   * @param searcherUserId - The user performing the search (optional)
   */
  private async getExclusionSet(searcherUserId?: string): Promise<Set<string>> {
    const excludeSet = new Set<string>();

    // Get non-suggestible users (deleted/suspended/banned)
    const nonSuggestibleUsers = await UserStatus.find({ isSuggestible: false })
      .select('userId')
      .lean();
    nonSuggestibleUsers.forEach((u) => excludeSet.add(u.userId));

    // Get blocked users (personalized blocking)
    if (searcherUserId) {
      const blockedUsers = await BlockList.find({
        $or: [
          { userId: searcherUserId }, // Users blocked by searcher
          { blockedUserId: searcherUserId }, // Users who blocked searcher
        ],
      })
        .lean();

      blockedUsers.forEach((b) => {
        if (b.userId === searcherUserId) {
          excludeSet.add(b.blockedUserId);
        } else {
          excludeSet.add(b.userId);
        }
      });
    }

    return excludeSet;
  }

  async execute(
    { query, types, limit }: SearchRequest,
    searcherUserId?: string
  ): Promise<SearchResult[]> {
    const excludeSet = await this.getExclusionSet(searcherUserId);
    const tasks: Array<Promise<SearchResult[]>> = [];

    const normalizedTypes = types.length ? types : ['users', 'posts', 'agents', 'pages'];

    if (normalizedTypes.includes('users')) {
      tasks.push(this.searchUsers(query, limit, excludeSet));
    }
    if (normalizedTypes.includes('posts')) {
      tasks.push(this.searchPosts(query, limit, excludeSet));
    }
    if (normalizedTypes.includes('agents')) {
      tasks.push(this.searchAgents(query, limit));
    }
    if (normalizedTypes.includes('pages')) {
      tasks.push(this.searchPages(query, limit));
    }

    const results = await Promise.all(tasks);
    return results.flat().slice(0, limit * normalizedTypes.length);
  }

  private async searchUsers(
    query: string,
    limit: number,
    excludeSet: Set<string>
  ): Promise<SearchResult[]> {
    const excludeArray = Array.from(excludeSet);
    const docs = await UserSearch.find(
      {
        $text: { $search: query },
        userId: { $nin: excludeArray },
      },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit);

    return docs.map((doc) => ({
      id: doc.userId,
      type: 'users',
      title: doc.name,
      subtitle: `@${doc.username}`,
      snippet: doc.bio,
      avatarUrl: doc.profilePicture,
      score: (doc as any).score,
    }));
  }

  private async searchPosts(
    query: string,
    limit: number,
    excludeSet: Set<string>
  ): Promise<SearchResult[]> {
    // Get posts with excluded authors
    const excludeArray = Array.from(excludeSet);
    const docs = await PostSearch.find(
      {
        $text: { $search: query },
        authorId: { $nin: excludeArray },
      },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit * 2) // Fetch extra for additional filtering
      .lean();

    // Additional filter: check PostAuthorStatus for deleted/blocked authors
    const postIds = docs.map((d) => d.postId);
    const authorStatuses = await PostAuthorStatus.find({
      postId: { $in: postIds },
      $or: [{ isAuthorDeleted: true }, { isAuthorBlocked: true }],
    })
      .select('postId')
      .lean();

    const excludedPostIds = new Set(authorStatuses.map((s) => s.postId));

    return docs
      .filter((doc) => !excludedPostIds.has(doc.postId))
      .slice(0, limit)
      .map((doc) => ({
        id: doc.postId,
        type: 'posts',
        title: doc.caption.slice(0, 80),
        snippet: doc.tags?.join(', '),
        avatarUrl: doc.mediaPreviewUrl,
        score: (doc as any).score,
      }));
  }

  private async searchAgents(query: string, limit: number): Promise<SearchResult[]> {
    const docs = await AgentSearch.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit);

    return docs.map((doc) => ({
      id: doc.agentId,
      type: 'agents',
      title: doc.name,
      snippet: doc.description,
      avatarUrl: doc.avatarUrl,
      score: (doc as any).score,
    }));
  }

  private async searchPages(query: string, limit: number): Promise<SearchResult[]> {
    const docs = await PageSearch.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit);

    return docs.map((doc) => ({
      id: doc.pageId,
      type: 'pages',
      title: doc.name,
      snippet: doc.description,
      avatarUrl: doc.avatarUrl,
      score: (doc as any).score,
    }));
  }

  async autocomplete(
    query: string,
    limit: number,
    types: string[] = ['users', 'posts', 'agents', 'pages'],
    searcherUserId?: string
  ): Promise<{ [key: string]: SearchResult[] }> {
    const excludeSet = await this.getExclusionSet(searcherUserId);
    const excludeArray = Array.from(excludeSet);
    const regex = new RegExp(`^${query}`, 'i');
    const results: { [key: string]: SearchResult[] } = {};

    if (types.includes('users')) {
      // Search by both name and username (case-insensitive prefix match)
      const users = await UserSearch.find({
        $or: [
          { name: regex },
          { username: regex },
        ],
        userId: { $nin: excludeArray },
      })
        .limit(limit)
        .lean();
      results.users = users.map((doc) => ({
        id: doc.userId,
        type: 'users' as const,
        title: doc.name,
        subtitle: `@${doc.username}`,
        avatarUrl: doc.profilePicture,
      }));
    }

    if (types.includes('posts')) {
      const posts = await PostSearch.find({
        caption: regex,
        authorId: { $nin: excludeArray },
      })
        .limit(limit)
        .lean();
      results.posts = posts.map((doc) => ({
        id: doc.postId,
        type: 'posts' as const,
        title: doc.caption.slice(0, 80),
        snippet: doc.tags?.join(', '),
        avatarUrl: doc.mediaPreviewUrl,
      }));
    }

    if (types.includes('agents')) {
      const agents = await AgentSearch.find({ name: regex }).limit(limit);
      results.agents = agents.map((doc) => ({
        id: doc.agentId,
        type: 'agents' as const,
        title: doc.name,
        snippet: doc.description,
        avatarUrl: doc.avatarUrl,
      }));
    }

    if (types.includes('pages')) {
      const pages = await PageSearch.find({ name: regex }).limit(limit);
      results.pages = pages.map((doc) => ({
        id: doc.pageId,
        type: 'pages' as const,
        title: doc.name,
        snippet: doc.description,
        avatarUrl: doc.avatarUrl,
      }));
    }

    return results;
  }
}

export const searchEngine = new SearchEngine();

