/**
 * Context - Memory Context Assembler
 *
 * Assembles memory context based on trigger type
 */

import type { MemoryContext, TriggerType } from './types.js';
import { readSoul, readPeople, readTasks, readCron, readCronSys, readAllL9 } from './l9.js';
import { readRecentMessages, readAllMessages } from './l0.js';
import { readDailySummaries } from './l1.js';
import { readWeeklySummaries } from './l2.js';
import { L1_DIR, L2_DIR, PATHS } from './constants.js';
import { buildVariableContext, substituteVariables, hasVariables } from './sys-inject.js';
import { getTodayString } from './utils.js';

/**
 * Stub functions for scheduler context
 */
export function getTaskContext(projectDir: string): string {
  const tasks = readTasks(projectDir);
  return tasks || 'No tasks defined';
}

export function getCronContext(projectDir: string, taskContent: string): string {
  const cron = readCron(projectDir);
  return cron || 'No cron tasks defined';
}

export function getCronSysContext(projectDir: string, taskContent: string): string {
  if (!taskContent) {
    return 'No task content provided';
  }
  
  if (hasVariables(taskContent)) {
    const variables = buildVariableContext(projectDir);
    return substituteVariables(taskContent, variables);
  }
  
  return taskContent;
}

/**
 * Get directory listing info
 */
function getDirectoryInfo(projectDir: string): string {
  const lines: string[] = [];
  lines.push(`# Memory System`);
  lines.push(`- L0 (raw messages): ${PATHS.L0}/`);
  lines.push(`- L1 (daily summaries): ${PATHS.L1}/`);
  lines.push(`- L2 (weekly summaries): ${PATHS.L2}/`);
  lines.push(`- L9 (long-term): SOUL.md, PEOPLE.md, TASK.md, CRON.md, CRON_SYS.md`);
  return lines.join('\n');
}

/**
 * Build memory context for a given trigger type
 */
export function buildMemoryContext(
  projectDir: string,
  triggerType: TriggerType
): MemoryContext {
  const longTermMemory = readAllL9(projectDir);
  const todayStr = getTodayString();
  const recentMessages = readRecentMessages(projectDir, todayStr, 60);
  const dailySummaries = readDailySummaries(projectDir, 3);
  const weeklySummaries = readWeeklySummaries(projectDir, 3);

  return {
    directoryInfo: getDirectoryInfo(projectDir),
    longTermMemory: {
      soul: longTermMemory.soul,
      people: longTermMemory.people,
      tasks: longTermMemory.tasks,
      cron: longTermMemory.cron,
      cronSys: longTermMemory.cronSys,
    },
    recentMessages,
    dailySummaries,
    weeklySummaries,
    triggerType,
  };
}

/**
 * Build context for feishu message trigger
 */
export function getFeishuContext(projectDir: string): MemoryContext {
  return buildMemoryContext(projectDir, 'feishu_message');
}

/**
 * Build context for scheduled trigger
 */
export function getScheduledContext(projectDir: string): MemoryContext {
  return buildMemoryContext(projectDir, 'scheduled');
}

/**
 * Format memory context as prompt text
 */
export function formatContextAsPrompt(context: MemoryContext): string {
  const parts: string[] = [];

  // Long-term memory
  if (context.longTermMemory.soul) {
    parts.push('## Agent Personality (SOUL)\n' + context.longTermMemory.soul);
  }

  if (context.longTermMemory.people) {
    parts.push('## User Profiles (PEOPLE)\n' + context.longTermMemory.people);
  }

  if (context.longTermMemory.tasks) {
    parts.push('## Current Tasks\n' + context.longTermMemory.tasks);
  }

  if (context.weeklySummaries.length > 0) {
    parts.push('## Weekly Summaries\n');
    for (const summary of context.weeklySummaries) {
      parts.push(`### ${summary.week_start} - ${summary.week_end}\n${summary.summary}`);
    }
  }

  if (context.dailySummaries.length > 0) {
    parts.push('## Recent Daily Summaries\n');
    for (const summary of context.dailySummaries) {
      parts.push(`### ${summary.date}\n${summary.summary}`);
    }
  }

  if (context.recentMessages.length > 0) {
    parts.push('## Recent Conversation\n');
    for (const msg of context.recentMessages) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      parts.push(`[${msg.timestamp}] ${role}: ${msg.content}`);
    }
  }

  return parts.join('\n\n');
}
