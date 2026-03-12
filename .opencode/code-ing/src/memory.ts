/**
 * code-ing Memory Management Module (Legacy Wrapper)
 *
 * Re-exports from memory/ modules for backward compatibility
 * New implementation: src/memory/
 */

export { loadFeishuConfig } from './memory/l9.js';
export { getFeishuContext, getScheduledContext, formatContextAsPrompt } from './memory/context.js';
export { startScheduler, stopScheduler } from './memory/scheduler.js';
export { getOrCreateManagedSession, rotateOldSessions, deleteOldSessions } from './memory/session.js';

// Legacy re-exports for backward compatibility
import { readLongTermMemory, writeLongTermMemory, readCron } from './memory/l9.js';
import { readShortTermMemory, writeShortTermMemory, readAllShortTermMemory } from './memory/l0.js';
import { MemoryContext } from './memory/types.js';

/**
 * Legacy buildMemoryContext - wraps new implementation
 */
export function buildMemoryContext(
  projectDir: string,
  trigger: string
): MemoryContext {
  // Map legacy trigger to new trigger type
  const triggerType = trigger === 'scheduled' ? 'scheduled' : 'feishu_message';
  const { getFeishuContext } = require('./memory/context.js');
  return getFeishuContext(projectDir);
}

export {
  readLongTermMemory,
  writeLongTermMemory,
  readCron,
  readShortTermMemory,
  writeShortTermMemory,
  readAllShortTermMemory,
  MemoryContext,
};
