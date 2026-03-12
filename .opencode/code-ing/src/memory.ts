/**
 * code-ing Memory Management Module (Legacy Wrapper)
 *
 * Re-exports from memory/ modules for backward compatibility
 * New implementation: src/memory/
 */

import { getFeishuContext, getScheduledContext, formatContextAsPrompt } from './memory/context.js';
import { startScheduler, stopScheduler, getNextScheduledTime } from './memory/scheduler.js';
import { getOrCreateManagedSession, rotateOldSessions, deleteOldSessions } from './memory/session.js';
import { writeDailySummary, readDailySummary, readDailySummaries } from './memory/l1.js';
import { writeWeeklySummary, readWeeklySummary, readWeeklySummaries } from './memory/l2.js';
import { readSoul, readPeople, readTasks, readCron, readCronSys, readAllL9 } from './memory/l9.js';
import { MessageRecord, DailySummary, WeeklySummary, MemoryContext, TriggerType } from './memory/types.js';

/**
 * Legacy buildMemoryContext - wraps new implementation
 */
export function buildMemoryContext(
  projectDir: string,
  trigger: string
): MemoryContext {
  // Map legacy trigger to new trigger type
  const triggerType: TriggerType = trigger === 'scheduled' ? 'scheduled' : 'feishu_message';
  return getFeishuContext(projectDir);
}

// Legacy function names for backward compatibility
export const loadFeishuConfig = {
  // Placeholder - actual config is read differently
};
export const readLongTermMemory = {
  soul: readSoul,
  people: readPeople,
  tasks: readTasks,
  cron: readCron,
  cronSys: readCronSys,
};
export const writeLongTermMemory = {
  // Write functions would be added if needed
};
export const readShortTermMemory = {
  // Would read from L0
};
export const writeShortTermMemory = {
  // Would write to L0  
};
export const readAllShortTermMemory = {
  // Would read all from L0
};

// Stub functions for summary generation (would integrate with LLM)
export function generateDailySummary(projectDir: string): void {
  // Placeholder - would call LLM to generate summary
  console.log('[memory] generateDailySummary not implemented - needs LLM integration');
}

export function generateWeeklySummary(projectDir: string): void {
  // Placeholder - would call LLM to generate summary
  console.log('[memory] generateWeeklySummary not implemented - needs LLM integration');
}

export {
  // From context
  getFeishuContext,
  getScheduledContext,
  formatContextAsPrompt,
  // From scheduler
  startScheduler,
  stopScheduler,
  getNextScheduledTime,
  // From session
  getOrCreateManagedSession,
  rotateOldSessions,
  deleteOldSessions,
  // From l1
  writeDailySummary,
  readDailySummary,
  readDailySummaries,
  // From l2
  writeWeeklySummary,
  readWeeklySummary,
  readWeeklySummaries,
  // From l9
  readSoul,
  readPeople,
  readTasks,
  readCron,
  readCronSys,
  readAllL9,
  // Types
  MessageRecord,
  DailySummary,
  WeeklySummary,
  MemoryContext,
  TriggerType,
};
