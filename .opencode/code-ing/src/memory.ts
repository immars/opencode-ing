/**
 * code-ing Memory Management Module (Legacy Wrapper)
 *
 * Re-exports from memory/ modules for backward compatibility
 * New implementation: src/memory/
 */

import { getFeishuContext, getScheduledContext, formatContextAsPrompt, getTaskContext, getCronContext, getCronSysContext } from './memory/context.js';
import { startScheduler, startSchedulerWithAgent, stopScheduler, getNextScheduledTime } from './scheduler.js';
import { getOrCreateManagedSession, rotateOldSessions, deleteOldSessions, CronSysSessionManager } from './memory/session.js';
import { buildVariableContext, substituteVariables, hasVariables } from './memory/sys-inject.js';
import { writeDailySummary, readDailySummary, readDailySummaries } from './memory/l1.js';
import { writeWeeklySummary, readWeeklySummary, readWeeklySummaries } from './memory/l2.js';
import { writeMessageRecord, readRecentMessages, readContacts, recordContact } from './memory/l0.js';
import { readSoul, readPeople, readTasks, readCron, readCronSys, readAllL9, loadFeishuConfig } from './memory/l9.js';
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
  // From context
  getFeishuContext,
  getScheduledContext,
  formatContextAsPrompt,
  // From scheduler
  startScheduler,
  startSchedulerWithAgent,
  stopScheduler,
  getNextScheduledTime,
  // From session
  getOrCreateManagedSession,
  rotateOldSessions,
  deleteOldSessions,
  CronSysSessionManager,
  // From sys-inject
  buildVariableContext,
  substituteVariables,
  hasVariables,
  // From l1
  writeDailySummary,
  readDailySummary,
  readDailySummaries,
  // From l2
  writeWeeklySummary,
  readWeeklySummary,
  readWeeklySummaries,
  // From l0
  writeMessageRecord,
  readRecentMessages,
  readContacts,
  recordContact,
  // From l9
  readSoul,
  readPeople,
  readTasks,
  readCron,
  readCronSys,
  readAllL9,
  loadFeishuConfig,
  // Types
  MessageRecord,
  DailySummary,
  WeeklySummary,
  MemoryContext,
  TriggerType,
};
