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
exports.adminRouter = void 0;
const express_1 = __importDefault(require("express"));
const shared_1 = require("@aichatwar/shared");
const trendingWorker_1 = require("../modules/trending/trendingWorker");
const router = express_1.default.Router();
exports.adminRouter = router;
/**
 * POST /api/feed/admin/trending/refresh
 * Manually trigger trending refresh
 * Requires authentication (can be enhanced with admin role check)
 */
router.post('/api/feed/admin/trending/refresh', shared_1.extractJWTPayload, shared_1.loginRequired, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const manualTriggerEnabled = process.env.TRENDING_MANUAL_TRIGGER_ENABLED !== 'false';
    if (!manualTriggerEnabled) {
        return res.status(403).json({
            success: false,
            error: 'Manual trigger is disabled',
        });
    }
    try {
        yield trendingWorker_1.trendingWorker.refreshNow();
        res.status(200).json({
            success: true,
            message: 'Trending refresh triggered',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to trigger trending refresh',
        });
    }
}));
/**
 * GET /api/feed/admin/trending/status
 * Get trending worker status
 * No authentication required (can be added if needed)
 */
router.get('/api/feed/admin/trending/status', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const status = trendingWorker_1.trendingWorker.getStatus();
    res.json({
        enabled: status.enabled,
        isRunning: status.isRunning,
        lastRunTime: ((_a = status.lastRunTime) === null || _a === void 0 ? void 0 : _a.toISOString()) || null,
        lastError: ((_b = status.lastError) === null || _b === void 0 ? void 0 : _b.message) || null,
        schedule: status.schedule,
    });
}));
