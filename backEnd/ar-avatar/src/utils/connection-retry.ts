import { setTimeout } from 'timers/promises';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
  retryable?: (error: any) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 30,
  initialDelayMs: 2000,
  maxDelayMs: 60000,
  multiplier: 2,
  retryable: () => true,
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context: string = 'Connection'
): Promise<T> {
  const mergedOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let currentDelay = mergedOptions.initialDelayMs;

  for (let i = 0; i < mergedOptions.maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (!mergedOptions.retryable(error)) {
        console.error(`❌ [${context}] Non-retryable error:`, error.message || error);
        throw error;
      }

      console.warn(`⚠️ [${context}] Attempt ${i + 1}/${mergedOptions.maxRetries} failed:`, error.message || error);
      if (i < mergedOptions.maxRetries - 1) {
        console.log(`[${context}] Retrying in ${currentDelay / 1000} seconds...`);
        await setTimeout(currentDelay);
        currentDelay = Math.min(currentDelay * mergedOptions.multiplier, mergedOptions.maxDelayMs);
      } else {
        console.error(`❌ [${context}] Max retries (${mergedOptions.maxRetries}) exceeded.`);
        throw error;
      }
    }
  }
  throw new Error(`[${context}] Failed after ${mergedOptions.maxRetries} retries.`);
}






