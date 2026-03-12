/**
 * Context - Memory Context Assembler
 *
 * Assembles memory context based on trigger type
 */

import type { MemoryContext, TriggerType } from './types.js';
import { readSoul, readPeople, readTasks, readCron, readCronSys } from './l9.js';
import { readRecentMessages } from './l0.js';

export function buildMemoryContext(
  projectDir: string,
  triggerType: TriggerType
): MemoryContext {
  // TODO: Implement
  return {
    directoryInfo: '',
    longTermMemory: {
      soul: '',
      people: '',
      tasks: '',
    },
    recentMessages: [],
    dailySummaries: [],
    weeklySummaries: [],
    triggerType,
  };
}

export function getFeishuContext(projectDir: string): MemoryContext {
  return buildMemoryContext(projectDir, 'feishu_message');
}

export function getScheduledContext(projectDir: string): MemoryContext {
  return buildMemoryContext(projectDir, 'scheduled');
}
