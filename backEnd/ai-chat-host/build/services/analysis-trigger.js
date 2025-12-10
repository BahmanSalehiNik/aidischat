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
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisTrigger = exports.AnalysisTrigger = void 0;
const room_analysis_state_1 = require("../models/room-analysis-state");
const constants_1 = require("../config/constants");
class AnalysisTrigger {
    /**
     * Check if analysis should be triggered for a room
     */
    shouldAnalyze(window, state) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cooldown first
            if (yield this.checkCooldown(state)) {
                console.log(`[AnalysisTrigger] Analysis skipped for room ${window.roomId} - cooldown active`);
                return false;
            }
            // Check time threshold
            const timeThresholdMet = yield this.checkTimeThreshold(window);
            if (timeThresholdMet) {
                console.log(`[AnalysisTrigger] Time threshold met for room ${window.roomId}`);
                return true;
            }
            // Check message threshold
            const messageThresholdMet = yield this.checkMessageThreshold(window, state);
            if (messageThresholdMet) {
                console.log(`[AnalysisTrigger] Message threshold met for room ${window.roomId}`);
                return true;
            }
            return false;
        });
    }
    /**
     * Check if time threshold is met (e.g., 30 seconds since last message)
     */
    checkTimeThreshold(window) {
        return __awaiter(this, void 0, void 0, function* () {
            if (window.messages.length === 0) {
                return false;
            }
            const timeSinceLastMessage = Date.now() - window.lastMessageAt.getTime();
            return timeSinceLastMessage >= constants_1.ANALYSIS_CONFIG.TIME_THRESHOLD_MS;
        });
    }
    /**
     * Check if message threshold is met (e.g., 5 new messages since last analysis)
     */
    checkMessageThreshold(window, state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!state || !state.lastAnalysisAt) {
                // No previous analysis - check if we have enough messages
                return window.messages.length >= constants_1.ANALYSIS_CONFIG.MESSAGE_THRESHOLD;
            }
            // Count messages since last analysis
            const lastAnalysisTime = state.lastAnalysisAt.getTime();
            const newMessagesCount = window.messages.filter(m => m.createdAt.getTime() > lastAnalysisTime).length;
            return newMessagesCount >= constants_1.ANALYSIS_CONFIG.MESSAGE_THRESHOLD;
        });
    }
    /**
     * Check if room is in cooldown period
     */
    checkCooldown(state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!state || !state.cooldownUntil) {
                return false;
            }
            const now = new Date();
            return state.cooldownUntil > now;
        });
    }
    /**
     * Set cooldown for a room
     */
    setCooldown(roomId, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const cooldownUntil = new Date(Date.now() + constants_1.ANALYSIS_CONFIG.MIN_COOLDOWN_MS);
            if (state) {
                state.cooldownUntil = cooldownUntil;
                yield state.save();
            }
            else {
                const newState = room_analysis_state_1.RoomAnalysisState.build({
                    roomId,
                    cooldownUntil,
                });
                yield newState.save();
            }
            console.log(`[AnalysisTrigger] Set cooldown for room ${roomId} until ${cooldownUntil.toISOString()}`);
        });
    }
    /**
     * Check rate limiting (max analyses per hour)
     */
    checkRateLimit(state) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!state) {
                return true; // No previous analyses, allow
            }
            // Check analyses in the last hour
            const oneHourAgo = new Date(Date.now() - 3600000);
            const recentAnalyses = yield room_analysis_state_1.RoomAnalysisState.findOne({
                roomId: state.roomId,
                lastAnalysisAt: { $gte: oneHourAgo },
            });
            // This is a simplified check - in production, you'd count actual analysis results
            // For now, we'll use a simple heuristic based on totalAnalyses
            if (state.totalAnalyses >= constants_1.ANALYSIS_CONFIG.MAX_ANALYSES_PER_HOUR) {
                const timeSinceFirstAnalysis = Date.now() - (((_a = state.lastAnalysisAt) === null || _a === void 0 ? void 0 : _a.getTime()) || Date.now());
                if (timeSinceFirstAnalysis < 3600000) {
                    return false; // Rate limit exceeded
                }
            }
            return true;
        });
    }
}
exports.AnalysisTrigger = AnalysisTrigger;
exports.analysisTrigger = new AnalysisTrigger();
