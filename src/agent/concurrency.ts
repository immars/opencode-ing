/**
 * Concurrency Module
 *
 * Provides async-friendly locking mechanisms for CLI operations.
 */

import { acquireLock, releaseLock } from '../cli/registry.js';

const DEFAULT_RETRY_DELAY = 50;
const DEFAULT_MAX_RETRIES = 100;

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap an async operation with a file lock, retrying if acquisition fails.
 *
 * @param fn - The async operation to wrap
 * @param maxRetries - Maximum number of retry attempts (default: 100)
 * @param retryDelay - Delay between retries in ms (default: 50)
 * @returns The result of the wrapped operation
 * @throws Error if lock cannot be acquired after all retries
 */
export async function withLock<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_MAX_RETRIES,
  retryDelay: number = DEFAULT_RETRY_DELAY
): Promise<T> {
  let retries = 0;

  while (retries < maxRetries) {
    if (acquireLock()) {
      try {
        return await fn();
      } finally {
        releaseLock();
      }
    }

    retries++;
    if (retries < maxRetries) {
      await sleep(retryDelay);
    }
  }

  throw new Error(`[Concurrency] Failed to acquire lock after ${maxRetries} retries`);
}
