/**
 * code-ing Memory Management Module (Legacy Wrapper)
 *
 * Re-exports from memory/ modules for backward compatibility
 * New implementation: src/memory/
 */

import { loadFeishuConfig } from './config.js';
import { getFeishuContext, getScheduledContext, formatContextAsPrompt } from './memory/context.js';
import { startScheduler, stopScheduler, getNextScheduledTime } from './memory/scheduler.js';
import { getOrCreateManagedSession, housekeepSessions } from './memory/session.js';
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
export async function generateDailySummary(projectDir: string, date: string): Promise<void> {
  // Placeholder - would call LLM to generate summary
  console.log(`[memory] generateDailySummary not implemented for ${date} - needs LLM integration`);
}

export async function generateWeeklySummary(projectDir: string, weekStartDate: string): Promise<void> {
  // Placeholder - would call LLM to generate summary
  console.log(`[memory] generateWeeklySummary not implemented for ${weekStartDate} - needs LLM integration`);
}

export {
  getFeishuContext,
  getScheduledContext,
  formatContextAsPrompt,
  startScheduler,
  stopScheduler,
  getNextScheduledTime,
  getOrCreateManagedSession,
  housekeepSessions,
  writeDailySummary,
  readDailySummary,
  readDailySummaries,
  writeWeeklySummary,
  readWeeklySummary,
  readWeeklySummaries,
  readSoul,
  readPeople,
  readTasks,
  readCron,
  readCronSys,
  readAllL9,
  loadFeishuConfig,
  MessageRecord,
  DailySummary,
  WeeklySummary,
  MemoryContext,
  TriggerType,
};
