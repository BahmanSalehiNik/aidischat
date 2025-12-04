"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentFeedScannerWorker = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const uuid_1 = require("uuid");
const shared_1 = require("@aichatwar/shared");
const user_1 = require("../models/user/user");
const feed_1 = require("../models/feed/feed");
const post_1 = require("../models/post/post");
const kafka_client_1 = require("../kafka-client");
const agentFeedScannedPublisher_1 = require("../events/publishers/agentFeedScannedPublisher");
// Configuration
const SCAN_INTERVAL_CRON = process.env.AGENT_FEED_SCAN_INTERVAL_CRON || '0 * * * *'; // Default: every hour
const TEST_SCAN_INTERVAL_CRON = process.env.TEST_AGENT_FEED_SCAN_INTERVAL_CRON || '*/30 * * * * *'; // Default: every 30 seconds for testing
const USE_TEST_INTERVAL = process.env.USE_TEST_AGENT_FEED_SCAN_INTERVAL === 'true';
const MAX_ITEMS_PER_SCAN = parseInt(process.env.MAX_AGENT_FEED_ITEMS_PER_SCAN || '50', 10);
class AgentFeedScannerWorker {
    constructor() {
        this.task = null;
        this.isRunning = false;
        this.lastScanTimes = new Map();
    }
    /**
     * Get all active agents that should be scanned
     */
    getActiveAgents() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const agents = yield user_1.User.find({
                    isAgent: true,
                    status: shared_1.UserStatus.Active,
                })
                    .select('_id ownerUserId')
                    .lean();
                return agents
                    .filter((agent) => agent.ownerUserId) // Only agents with owners
                    .map((agent) => ({
                    id: agent._id.toString(),
                    ownerUserId: agent.ownerUserId,
                }));
            }
            catch (error) {
                console.error('[AgentFeedScanner] Error fetching active agents:', error);
                return [];
            }
        });
    }
    /**
     * Get agent's feed data (only unseen items to avoid duplicate processing)
     */
    getAgentFeedData(agentId, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get ONLY unseen feed entries for agent (not already processed)
            const feedEntries = yield feed_1.Feed.find({
                userId: agentId,
                status: feed_1.FeedStatus.Unseen, // Only get unseen items
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
            const posts = yield post_1.Post.find({ _id: { $in: postIds } })
                .sort({ createdAt: -1 })
                .lean();
            // Transform posts for event
            const postsData = posts.map((post) => {
                var _a;
                return ({
                    id: post._id.toString(),
                    userId: post.userId,
                    content: post.content,
                    media: post.media,
                    createdAt: ((_a = post.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || post.originalCreation,
                    reactionsSummary: post.reactionsSummary || [],
                    commentsCount: post.commentsCount || 0,
                });
            });
            // Note: Individual comments and reactions are not stored in Feed Service
            // They are aggregated in Post projection (commentsCount, reactionsSummary)
            // For now, we return empty arrays. This can be enhanced later if needed
            // by adding Comment and Reaction projections to Feed Service.
            return {
                posts: postsData,
                comments: [], // TODO: Add Comment projection to Feed Service if individual comments are needed
                reactions: [], // TODO: Add Reaction projection to Feed Service if individual reactions are needed
                feedEntryIds, // Return feed entry IDs so we can mark them as seen after processing
            };
        });
    }
    /**
     * Scan an agent's feed and publish agent.feed.scanned event
     * Only publishes if there are new unseen posts
     */
    scanAgentFeed(agentId, ownerUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            const scanId = (0, uuid_1.v4)();
            const scanTimestamp = new Date().toISOString();
            const lastScanTime = this.lastScanTimes.get(agentId);
            const scanInterval = lastScanTime
                ? Math.floor((Date.now() - lastScanTime.getTime()) / 1000 / 60) // minutes
                : 60; // Default to 60 minutes if no previous scan
            try {
                console.log(`[AgentFeedScanner] Starting feed scan for agent ${agentId} (scanId: ${scanId})`);
                // Get agent's feed data (only unseen items)
                const feedData = yield this.getAgentFeedData(agentId, MAX_ITEMS_PER_SCAN);
                console.log(`[AgentFeedScanner] Fetched feed for agent ${agentId}: ${feedData.posts.length} posts, ${feedData.comments.length} comments, ${feedData.reactions.length} reactions`);
                // Skip if no new posts to process
                if (feedData.posts.length === 0) {
                    console.log(`[AgentFeedScanner] ⏭️  Skipping agent ${agentId} - no new unseen posts`);
                    return;
                }
                // Extract feedEntryIds for tracking
                const { feedEntryIds } = feedData, feedDataForEvent = __rest(feedData, ["feedEntryIds"]);
                // Mark feed entries as "seen" immediately when fetched (to avoid duplicate processing)
                if (feedEntryIds && feedEntryIds.length > 0) {
                    const result = yield feed_1.Feed.updateMany({ _id: { $in: feedEntryIds }, userId: agentId }, { $set: { status: feed_1.FeedStatus.Seen } });
                    console.log(`[AgentFeedScanner] ✅ Marked ${result.modifiedCount} feed entries as seen for agent ${agentId}`);
                }
                // Publish agent.feed.scanned event
                yield new agentFeedScannedPublisher_1.AgentFeedScannedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
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
            }
            catch (error) {
                console.error(`[AgentFeedScanner] ❌ Error scanning feed for agent ${agentId}:`, {
                    error: error.message,
                    stack: error.stack,
                    scanId,
                });
                // Don't throw - continue with other agents
            }
        });
    }
    /**
     * Start the background worker
     */
    start() {
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
        this.task = node_cron_1.default.schedule(cronExpression, () => __awaiter(this, void 0, void 0, function* () {
            console.log(`[AgentFeedScanner] Starting scheduled feed scan (${new Date().toISOString()})`);
            try {
                // Get all active agents
                const agents = yield this.getActiveAgents();
                console.log(`[AgentFeedScanner] Found ${agents.length} active agents to scan`);
                // Scan each agent's feed (with concurrency limit to avoid overwhelming services)
                const concurrencyLimit = 5;
                for (let i = 0; i < agents.length; i += concurrencyLimit) {
                    const batch = agents.slice(i, i + concurrencyLimit);
                    yield Promise.all(batch.map((agent) => this.scanAgentFeed(agent.id, agent.ownerUserId)));
                }
                console.log(`[AgentFeedScanner] ✅ Scheduled feed scan completed for ${agents.length} agents`);
            }
            catch (error) {
                console.error('[AgentFeedScanner] ❌ Error in scheduled feed scan:', error);
            }
        }));
        this.isRunning = true;
        console.log(`[AgentFeedScanner] ✅ Background worker started (runs every ${intervalDescription})`);
    }
    /**
     * Stop the background worker
     */
    stop() {
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
exports.agentFeedScannerWorker = new AgentFeedScannerWorker();
