/**
 * Agent Feed Scanner Worker
 * 
 * Periodically scans agent feeds and publishes agent.feed.scanned events.
 * This worker runs in the Feed Service since it already has all the feed data.
 * 
 * Architecture:
 * - Scans all active agents' feeds
 * - Publishes agent.feed.scanned events to Kafka
 * - AI Gateway consumes these events for processing
 */

import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { UserStatus } from '@aichatwar/shared';
import { User } from '../models/user/user';
import { Feed, FeedStatus } from '../models/feed/feed';
import { Post } from '../models/post/post';
import { Comment } from '../models/comment/comment';
import { kafkaWrapper } from '../kafka-client';
import { AgentFeedScannedPublisher } from '../events/publishers/agentFeedScannedPublisher';

// Configuration
const SCAN_INTERVAL_CRON = process.env.AGENT_FEED_SCAN_INTERVAL_CRON || '0 * * * *'; // Default: every hour
const TEST_SCAN_INTERVAL_CRON = process.env.TEST_AGENT_FEED_SCAN_INTERVAL_CRON || '*/30 * * * * *'; // Default: every 30 seconds for testing
const USE_TEST_INTERVAL = process.env.USE_TEST_AGENT_FEED_SCAN_INTERVAL === 'true';
const MAX_ITEMS_PER_SCAN = parseInt(process.env.MAX_AGENT_FEED_ITEMS_PER_SCAN || '50', 10);

interface AgentFeedScanState {
  agentId: string;
  ownerUserId: string;
  lastScanTime: Date | null;
}

class AgentFeedScannerWorker {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private isRunning: boolean = false;
  private lastScanTimes: Map<string, Date> = new Map();

  /**
   * Get all active agents that should be scanned
   */
  async getActiveAgents(): Promise<Array<{ id: string; ownerUserId: string }>> {
    try {
      const agents = await User.find({
        isAgent: true,
        status: UserStatus.Active,
      })
        .select('_id ownerUserId')
        .lean();

      return agents
        .filter((agent) => agent.ownerUserId) // Only agents with owners
        .map((agent) => ({
          id: agent._id.toString(),
          ownerUserId: agent.ownerUserId!,
        }));
    } catch (error: any) {
      console.error('[AgentFeedScanner] Error fetching active agents:', error);
      return [];
    }
  }

  /**
   * Get agent's feed data (only unseen items to avoid duplicate processing)
   */
  async getAgentFeedData(agentId: string, limit: number): Promise<{
    posts: Array<{
      id: string;
      userId: string;
      content: string;
      media?: Array<{ id: string; url: string; type: string }>;
      createdAt: string;
      reactionsSummary: Array<{ type: string; count: number }>;
      commentsCount: number;
    }>;
    comments: Array<{
      id: string;
      postId: string;
      userId: string;
      content: string;
      createdAt: string;
    }>;
    reactions: Array<{
      id: string;
      postId?: string;
      commentId?: string;
      userId: string;
      type: string;
      createdAt: string;
    }>;
    feedEntryIds: string[]; // Track which feed entries are included in this batch
  }> {
    // Get ONLY unseen feed entries for agent (not already processed)
    const feedEntries = await Feed.find({
      userId: agentId,
      status: FeedStatus.Unseen, // Only get unseen items
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    if (feedEntries.length === 0) {
      return { posts: [], comments: [], reactions: [], feedEntryIds: [] };
    }

    // Get post IDs from feed
    const postIds = feedEntries.map((f) => f.postId);
    const feedEntryIds = feedEntries.map((f) => f._id.toString());

    // Fetch posts from Post projection
    const posts = await Post.find({ _id: { $in: postIds } })
      .sort({ createdAt: -1 })
      .lean();

    // Filter out agent-authored posts so agents only react to human-created posts
    // (If authorIsAgent is missing, treat it as human/false for backward compatibility.)
    const humanPosts = posts.filter((post: any) => !(post as any).authorIsAgent);

    // Transform posts for event
    const postsData = humanPosts.map((post: any) => ({
      id: post._id.toString(),
      userId: post.userId,
      content: post.content,
      media: post.media,
      createdAt: post.createdAt?.toISOString() || post.originalCreation,
      reactionsSummary: post.reactionsSummary || [],
      commentsCount: post.commentsCount || 0,
    }));

    // Include a small set of recent HUMAN comments for these human posts.
    // This enables AI to draft reactions on comments (targeting commentId) while keeping payload small.
    const humanPostIds = postsData.map((p) => p.id);
    const MAX_COMMENTS_PER_SCAN = 20;
    const MAX_COMMENTS_PER_POST = 3;

    let commentsData: Array<{
      id: string;
      postId: string;
      userId: string;
      content: string;
      createdAt: string;
    }> = [];

    if (humanPostIds.length > 0) {
      const comments = await Comment.find({
        postId: { $in: humanPostIds },
        // Only include human-authored comments (avoid agents reacting to agent content)
        authorIsAgent: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .limit(MAX_COMMENTS_PER_SCAN)
        .lean();

      // Cap per-post to keep distribution fair across the batch
      const perPostCount = new Map<string, number>();
      for (const c of comments) {
        const pid = String((c as any).postId);
        const count = perPostCount.get(pid) || 0;
        if (count >= MAX_COMMENTS_PER_POST) continue;
        perPostCount.set(pid, count + 1);

        commentsData.push({
          id: String((c as any)._id),
          postId: pid,
          userId: String((c as any).userId),
          content: String((c as any).text || ''),
          createdAt: ((c as any).createdAt ? new Date((c as any).createdAt).toISOString() : new Date().toISOString()),
        });
      }
    }

    return {
      posts: postsData,
      comments: commentsData,
      reactions: [], // TODO: Add Reaction projection to Feed Service if individual reactions are needed
      feedEntryIds, // Return feed entry IDs so we can mark them as seen after processing
    };
  }

  /**
   * Scan an agent's feed and publish agent.feed.scanned event
   * Only publishes if there are new unseen posts
   */
  async scanAgentFeed(agentId: string, ownerUserId: string): Promise<void> {
    const scanId = uuidv4();
    const scanTimestamp = new Date().toISOString();
    const lastScanTime = this.lastScanTimes.get(agentId);
    const scanInterval = lastScanTime
      ? Math.floor((Date.now() - lastScanTime.getTime()) / 1000 / 60) // minutes
      : 60; // Default to 60 minutes if no previous scan

    try {
      console.log(`[AgentFeedScanner] Starting feed scan for agent ${agentId} (scanId: ${scanId})`);

      // Get agent's feed data (only unseen items)
      const feedData = await this.getAgentFeedData(agentId, MAX_ITEMS_PER_SCAN);

      console.log(
        `[AgentFeedScanner] Fetched feed for agent ${agentId}: ${feedData.posts.length} posts, ${feedData.comments.length} comments, ${feedData.reactions.length} reactions`
      );

      // Extract feedEntryIds for tracking
      const { feedEntryIds, ...feedDataForEvent } = feedData;

      // Mark feed entries as "seen" immediately when fetched (to avoid duplicate processing)
      if (feedEntryIds && feedEntryIds.length > 0) {
        const result = await Feed.updateMany(
          { _id: { $in: feedEntryIds }, userId: agentId },
          { $set: { status: FeedStatus.Seen } }
        );
        console.log(`[AgentFeedScanner] ✅ Marked ${result.modifiedCount} feed entries as seen for agent ${agentId}`);
      }

      // Skip publish if no (human) posts to process
      if (feedData.posts.length === 0) {
        console.log(`[AgentFeedScanner] ⏭️  Skipping agent ${agentId} - no new unseen human posts`);
        return;
      }

      // Publish agent.feed.scanned event
      await new AgentFeedScannedPublisher(kafkaWrapper.producer).publish({
        agentId,
        ownerUserId,
        scanId,
        feedData: feedDataForEvent,
        scanTimestamp,
        scanInterval,
        feedEntryIds, // Include feed entry IDs for tracking (already marked as seen above)
      });

      // Update last scan time
      this.lastScanTimes.set(agentId, new Date());

      console.log(`[AgentFeedScanner] ✅ Published agent.feed.scanned event for agent ${agentId} (scanId: ${scanId}, ${feedData.posts.length} posts)`);
    } catch (error: any) {
      console.error(`[AgentFeedScanner] ❌ Error scanning feed for agent ${agentId}:`, {
        error: error.message,
        stack: error.stack,
        scanId,
      });
      // Don't throw - continue with other agents
    }
  }

  /**
   * Start the background worker
   */
  start(): void {
    if (this.task) {
      console.log('[AgentFeedScanner] Already running');
      return;
    }

    const enabled = process.env.AGENT_FEED_SCANNER_ENABLED !== 'false';
    if (!enabled) {
      console.log('[AgentFeedScanner] Disabled via AGENT_FEED_SCANNER_ENABLED');
      return;
    }

    // Use test interval if enabled, otherwise use production interval
    const cronExpression = USE_TEST_INTERVAL ? TEST_SCAN_INTERVAL_CRON : SCAN_INTERVAL_CRON;
    const intervalDescription = USE_TEST_INTERVAL ? '30 seconds (TEST MODE)' : '1 hour';

    console.log(`[AgentFeedScanner] Scheduling feed scans with interval: ${intervalDescription} (cron: ${cronExpression})`);

    this.task = cron.schedule(cronExpression, async () => {
      console.log(`[AgentFeedScanner] Starting scheduled feed scan (${new Date().toISOString()})`);

      try {
        // Get all active agents
        const agents = await this.getActiveAgents();
        console.log(`[AgentFeedScanner] Found ${agents.length} active agents to scan`);

        // Scan each agent's feed (with concurrency limit to avoid overwhelming services)
        const concurrencyLimit = 5;
        for (let i = 0; i < agents.length; i += concurrencyLimit) {
          const batch = agents.slice(i, i + concurrencyLimit);
          await Promise.all(batch.map((agent) => this.scanAgentFeed(agent.id, agent.ownerUserId)));
        }

        console.log(`[AgentFeedScanner] ✅ Scheduled feed scan completed for ${agents.length} agents`);
      } catch (error: any) {
        console.error('[AgentFeedScanner] ❌ Error in scheduled feed scan:', error);
      }
    });

    this.isRunning = true;
    console.log(`[AgentFeedScanner] ✅ Background worker started (runs every ${intervalDescription})`);
  }

  /**
   * Stop the background worker
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      this.isRunning = false;
      console.log('[AgentFeedScanner] Background worker stopped');
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    const cronExpr = USE_TEST_INTERVAL ? TEST_SCAN_INTERVAL_CRON : SCAN_INTERVAL_CRON;
    return {
      enabled: this.task !== null,
      isRunning: this.isRunning,
      schedule: cronExpr,
      agentsScanned: this.lastScanTimes.size,
    };
  }
}

export const agentFeedScannerWorker = new AgentFeedScannerWorker();

