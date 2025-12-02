"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fanoutWorker = void 0;
// src/workers/fanout-worker.ts
const bullmq_1 = require("bullmq");
const mongoose_1 = __importDefault(require("mongoose"));
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!process.env.MONGO_URI)
        throw new Error('MONGO_URI must be defined');
    if (!process.env.REDIS_HOST)
        throw new Error('REDIS_HOST must be defined');
    yield mongoose_1.default.connect(process.env.MONGO_URI);
    console.log('[Worker] Connected to MongoDB');
});
start();
const feed_1 = require("../models/feed/feed");
const freindship_1 = require("../models/friendship/freindship");
const user_1 = require("../models/user/user");
const shared_1 = require("@aichatwar/shared");
const fanoutWorker = new bullmq_1.Worker('fanout-job', (job) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(job.data, "secret job");
    const { postId, authorId, visibility } = job.data;
    let recipients = [];
    // Always include the author in their own feed
    const authorIncluded = new Set([authorId]);
    if (visibility === 'public') {
        console.log('vis');
        // everyone or friends — simplified here
        const friendships = yield freindship_1.Friendship.find({
            status: 'accepted',
            $or: [{ requester: authorId }, { recipient: authorId }],
        });
        console.log(friendships, "freinds");
        // map both requester/recipient pairs correctly
        const friendIds = friendships.map(f => f.requester === authorId ? f.recipient : f.requester);
        // Add friends to recipients
        friendIds.forEach(id => authorIncluded.add(id));
        console.log(Array.from(authorIncluded), "rec");
        // For public posts, also add to all active agents' feeds
        // This allows agents to see public posts and generate content based on them
        try {
            const activeAgents = yield user_1.User.find({
                isAgent: true,
                status: shared_1.UserStatus.Active,
            })
                .select('_id')
                .lean();
            const agentIds = activeAgents.map(agent => agent._id.toString());
            console.log(`[FanoutWorker] Found ${agentIds.length} active agents for public post fanout`);
            // Add agents to recipients (excluding the author if the author is an agent)
            agentIds.forEach(agentId => {
                if (agentId !== authorId) {
                    authorIncluded.add(agentId);
                }
            });
        }
        catch (err) {
            console.error('[FanoutWorker] Error fetching active agents:', err);
            // Continue with normal fanout even if agent fetch fails
        }
    }
    else if (visibility === 'friends') {
        const friendships = yield freindship_1.Friendship.find({
            status: 'accepted',
            $or: [{ requester: authorId }, { recipient: authorId }],
        });
        const friendIds = friendships.map(f => f.requester === authorId ? f.recipient : f.requester);
        friendIds.forEach(id => authorIncluded.add(id));
    }
    // else: private - only author (already in set)
    recipients = Array.from(authorIncluded);
    if (!recipients.length)
        return;
    console.log(recipients, "rec");
    // Determine which recipients are agents (for setting FeedReason)
    const agentIdsSet = new Set();
    if (visibility === 'public') {
        try {
            const activeAgents = yield user_1.User.find({
                isAgent: true,
                status: shared_1.UserStatus.Active,
            })
                .select('_id')
                .lean();
            activeAgents.forEach(agent => agentIdsSet.add(agent._id.toString()));
        }
        catch (err) {
            console.error('[FanoutWorker] Error fetching agents for reason determination:', err);
        }
    }
    // Create feed entries with appropriate reason
    const feedEntries = recipients.map(uid => {
        // Determine reason: Recommendation if it's an agent seeing a public post (and not the author)
        // Otherwise, Friend
        const reason = (uid !== authorId &&
            visibility === 'public' &&
            agentIdsSet.has(uid))
            ? feed_1.FeedReason.Recommendation
            : feed_1.FeedReason.Friend;
        return {
            userId: uid,
            postId,
            sourceUserId: authorId,
            reason,
            originalCreationTime: new Date().toISOString(),
        };
    });
    console.log(feedEntries, "feed");
    try {
        const res = yield feed_1.Feed.insertMany(feedEntries, { ordered: false });
        console.log('Inserted feed entries:', res.length);
    }
    catch (err) {
        console.error('Error inserting feeds:', err);
    }
}), {
    connection: { host: process.env.REDIS_HOST || 'expiration-redis-srv', port: 6379 },
});
exports.fanoutWorker = fanoutWorker;
