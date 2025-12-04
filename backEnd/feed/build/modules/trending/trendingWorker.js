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
exports.trendingWorker = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const trendingService_1 = require("./trendingService");
const DEFAULT_CRON = '*/5 * * * *';
class TrendingWorker {
    constructor() {
        this.task = null;
        this.isRunning = false;
        this.lastRunTime = null;
        this.lastError = null;
        this.refreshPromise = null;
    }
    start() {
        if (this.task) {
            return;
        }
        const enabled = process.env.TRENDING_WORKER_ENABLED !== 'false';
        if (!enabled) {
            console.log('Trending worker disabled via TRENDING_WORKER_ENABLED');
            return;
        }
        const cronExpr = process.env.TRENDING_REFRESH_CRON || DEFAULT_CRON;
        console.log(`Starting trending worker with schedule: ${cronExpr}`);
        this.task = node_cron_1.default.schedule(cronExpr, () => {
            this.executeRefresh().catch((err) => console.error('Scheduled trending refresh failed', err));
        });
        // Initial refresh on startup
        this.executeRefresh().catch((err) => console.error('Initial trending refresh failed', err));
    }
    stop() {
        if (this.task) {
            this.task.stop();
            this.task = null;
            console.log('Trending worker stopped');
        }
    }
    refreshNow() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning) {
                throw new Error('Trending refresh already in progress');
            }
            return this.executeRefresh();
        });
    }
    executeRefresh() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning) {
                console.warn('Trending refresh already in progress, skipping');
                return;
            }
            this.isRunning = true;
            this.lastError = null;
            const startTime = Date.now();
            try {
                const timeout = parseInt(process.env.TRENDING_REFRESH_TIMEOUT || '300', 10) * 1000;
                this.refreshPromise = Promise.race([
                    trendingService_1.trendingService.refreshNow(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh timeout')), timeout))
                ]);
                yield this.refreshPromise;
                this.lastRunTime = new Date();
                const duration = Date.now() - startTime;
                console.log(`Trending refresh completed in ${duration}ms`);
            }
            catch (error) {
                this.lastError = error;
                console.error('Trending refresh failed:', error);
                throw error;
            }
            finally {
                this.isRunning = false;
                this.refreshPromise = null;
            }
        });
    }
    getStatus() {
        const cronExpr = process.env.TRENDING_REFRESH_CRON || DEFAULT_CRON;
        return {
            enabled: this.task !== null,
            isRunning: this.isRunning,
            lastRunTime: this.lastRunTime,
            lastError: this.lastError,
            schedule: cronExpr,
        };
    }
}
exports.trendingWorker = new TrendingWorker();
