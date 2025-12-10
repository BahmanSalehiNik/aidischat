"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitationCoordinator = exports.InvitationCoordinator = void 0;
const room_analysis_state_1 = require("../models/room-analysis-state");
const constants_1 = require("../config/constants");
const room_agent_invited_publisher_1 = require("../events/publishers/room-agent-invited-publisher");
const kafka_client_1 = require("../kafka-client");
class InvitationCoordinator {
    /**
     * Coordinate agent invitations based on analysis results
     * Checks existing participants and respects limits
     */
    inviteAgents(agentMatches, roomId, analysis) {
        return __awaiter(this, void 0, void 0, function* () {
            if (agentMatches.length === 0) {
                console.log(`[InvitationCoordinator] No agents to invite for room ${roomId}`);
                return;
            }
            // Get room analysis state
            let state = yield room_analysis_state_1.RoomAnalysisState.findOne({ roomId });
            if (!state) {
                const newState = room_analysis_state_1.RoomAnalysisState.build({ roomId });
                yield newState.save();
                state = yield room_analysis_state_1.RoomAnalysisState.findOne({ roomId });
            }
            // Ensure state is not null
            if (!state) {
                console.error(`[InvitationCoordinator] Failed to create state for room ${roomId}`);
                return;
            }
            // Check existing participants (we'll get this from an event or projection)
            // For now, we'll track invited agents in the state to prevent duplicates
            const recentlyInvited = yield this.getRecentlyInvitedAgents(roomId, state);
            // Filter out recently invited agents
            const eligibleMatches = agentMatches.filter(match => !recentlyInvited.has(match.agentId));
            if (eligibleMatches.length === 0) {
                console.log(`[InvitationCoordinator] All agents were recently invited for room ${roomId}`);
                return;
            }
            // Limit number of invitations
            const matchesToInvite = eligibleMatches.slice(0, constants_1.ANALYSIS_CONFIG.MAX_INVITATIONS_PER_ANALYSIS);
            // Invite each agent
            const invitedAgentIds = [];
            for (const match of matchesToInvite) {
                try {
                    yield this.publishInvitation(match, roomId, analysis);
                    invitedAgentIds.push(match.agentId);
                    console.log(`[InvitationCoordinator] ✅ Invited agent ${match.agentId} to room ${roomId}`, {
                        relevanceScore: match.relevanceScore,
                        reasons: match.matchReasons,
                    });
                }
                catch (error) {
                    console.error(`[InvitationCoordinator] ❌ Failed to invite agent ${match.agentId}:`, error);
                }
            }
            // Update state
            state.lastInvitationAt = new Date();
            state.totalInvitations += invitedAgentIds.length;
            yield state.save();
            console.log(`[InvitationCoordinator] Invited ${invitedAgentIds.length} agents to room ${roomId}`);
        });
    }
    /**
     * Get agents that were recently invited (within cooldown period)
     */
    getRecentlyInvitedAgents(roomId, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const recentlyInvited = new Set();
            // Check invitation history in analysis results
            const cooldownTime = new Date(Date.now() - constants_1.ANALYSIS_CONFIG.AGENT_INVITATION_COOLDOWN_MS);
            const { RoomAnalysisResult } = yield Promise.resolve().then(() => __importStar(require('../models/room-analysis-result')));
            const recentResults = yield RoomAnalysisResult.find({
                roomId,
                analyzedAt: { $gte: cooldownTime },
            }).lean();
            for (const result of recentResults) {
                for (const agentId of result.invitedAgentIds || []) {
                    recentlyInvited.add(agentId);
                }
            }
            return recentlyInvited;
        });
    }
    /**
     * Publish RoomAgentInvitedEvent to Kafka
     */
    publishInvitation(match, roomId, analysis) {
        return __awaiter(this, void 0, void 0, function* () {
            const reason = match.matchReasons.join(', ');
            // Publish invitation event
            // RoomAgentInvitedEvent expects: agentId, roomId, invitedBy, timestamp
            yield new room_agent_invited_publisher_1.RoomAgentInvitedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
                agentId: match.agentId,
                roomId,
                invitedBy: 'ai-chat-host',
                timestamp: new Date().toISOString(),
            });
            console.log(`[InvitationCoordinator] Published RoomAgentInvitedEvent for agent ${match.agentId} to room ${roomId}`);
        });
    }
}
exports.InvitationCoordinator = InvitationCoordinator;
exports.invitationCoordinator = new InvitationCoordinator();
