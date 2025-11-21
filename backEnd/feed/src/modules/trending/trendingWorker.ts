import cron from 'node-cron';
import { trendingService } from './trendingService';

const DEFAULT_CRON = '*/5 * * * *';

export interface WorkerStatus {
  enabled: boolean;
  isRunning: boolean;
  lastRunTime: Date | null;
  lastError: Error | null;
  schedule: string;
}

class TrendingWorker {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private lastError: Error | null = null;
  private refreshPromise: Promise<void> | null = null;

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
    
    this.task = cron.schedule(cronExpr, () => {
      this.executeRefresh().catch((err) => 
        console.error('Scheduled trending refresh failed', err)
      );
    });

    // Initial refresh on startup
    this.executeRefresh().catch((err) => 
      console.error('Initial trending refresh failed', err)
    );
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('Trending worker stopped');
    }
  }

  async refreshNow(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Trending refresh already in progress');
    }
    return this.executeRefresh();
  }

  private async executeRefresh(): Promise<void> {
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
        trendingService.refreshNow(),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Refresh timeout')), timeout)
        )
      ]) as Promise<void>;

      await this.refreshPromise;

      this.lastRunTime = new Date();
      const duration = Date.now() - startTime;
      console.log(`Trending refresh completed in ${duration}ms`);
    } catch (error) {
      this.lastError = error as Error;
      console.error('Trending refresh failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.refreshPromise = null;
    }
  }

  getStatus(): WorkerStatus {
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

export const trendingWorker = new TrendingWorker();

