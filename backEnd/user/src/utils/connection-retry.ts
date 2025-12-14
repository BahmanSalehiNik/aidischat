/**
 * Utility for retrying connections with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 30, // 30 retries
  initialDelayMs: 2000, // Start with 2 seconds
  maxDelayMs: 30000, // Max 30 seconds between retries
  backoffMultiplier: 1.5, // Exponential backoff
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context: string = 'Connection'
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let delay = opts.initialDelayMs;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === opts.maxRetries) {
        console.error(`[${context}] Failed after ${attempt + 1} attempts:`, lastError.message);
        throw lastError;
      }

      const errorMsg = lastError.message || String(lastError);
      const isConnectionError = 
        errorMsg.includes('ECONNREFUSED') ||
        errorMsg.includes('ENOTFOUND') ||
        errorMsg.includes('ETIMEDOUT') ||
        errorMsg.includes('connection') ||
        errorMsg.includes('not ready');

      if (isConnectionError) {
        console.log(`[${context}] Connection attempt ${attempt + 1}/${opts.maxRetries + 1} failed (${errorMsg}). Retrying in ${delay}ms...`);
      } else {
        // Non-connection errors might be configuration issues, but still retry a few times
        if (attempt < 3) {
          console.warn(`[${context}] Attempt ${attempt + 1} failed: ${errorMsg}. Retrying...`);
        } else {
          console.error(`[${context}] Non-connection error after ${attempt + 1} attempts:`, errorMsg);
          throw lastError;
        }
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError || new Error(`${context} failed after ${opts.maxRetries + 1} attempts`);
}

