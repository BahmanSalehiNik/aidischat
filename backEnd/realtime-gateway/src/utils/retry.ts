/**
 * Retry utility for async operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

