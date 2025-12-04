import { User, UserDoc } from '../models/user';
/**
 * Wait for user to be created in the database (handles race condition after signup)
 * Retries up to 50 times (5 seconds total) waiting for UserCreated event to be processed
 * Increased from 2 seconds to handle cases where Kafka events take longer to process
 */
export async function waitForUser(userId: string, maxRetries = 50, delayMs = 100): Promise<UserDoc | null> {
  let user = await User.findOne({ _id: userId, isDeleted: false });
  
  if (!user) {
    console.log(`[waitForUser] User ${userId} not found, waiting for UserCreated event...`);
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      user = await User.findOne({ _id: userId, isDeleted: false });
      if (user) {
        console.log(`[waitForUser] User ${userId} found after ${(i + 1) * delayMs}ms`);
        return user;
      }
      // Log progress every 10 retries to help with debugging
      if ((i + 1) % 10 === 0) {
        console.log(`[waitForUser] User ${userId} still waiting... (${(i + 1) * delayMs}ms elapsed)`);
      }
    }
    console.warn(`[waitForUser] User ${userId} still not found after ${maxRetries * delayMs}ms`);
  }
  
  return user;
}

