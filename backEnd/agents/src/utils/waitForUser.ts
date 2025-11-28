import { User, UserDoc } from '../models/user';
/**
 * Wait for user to be created in the database (handles race condition after signup)
 * Retries up to 20 times (2 seconds total) waiting for UserCreated event to be processed
 */
export async function waitForUser(userId: string, maxRetries = 20, delayMs = 100): Promise<UserDoc | null> {
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
    }
    console.warn(`[waitForUser] User ${userId} still not found after ${maxRetries * delayMs}ms`);
  }
  
  return user;
}

