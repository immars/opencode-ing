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
import { readWeeklySummaries as readL2WeeklySummaries } from './l2.js';
import { L1_DIR, L2_DIR, PATHS } from './constants.js';

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
  // Read L9 files (long-term memory)
  const longTermMemory = readAllL9(projectDir);

  // Read recent messages from L0
  const today = new Date().toISOString().split('T')[0];
  const recentMessages = readRecentMessages(projectDir, today, 60);

  // Read L1 summaries (last 3 days)
  const dailySummaries = readDailySummaries(projectDir, 3);

  // Read L2 summaries (last 3 weeks)
  const weeklySummaries = readL2WeeklySummaries(projectDir, 3);

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

  // Daily summaries
  if (context.dailySummaries.length > 0) {
    parts.push('## Recent Daily Summaries\n');
    for (const summary of context.dailySummaries) {
      parts.push(`### ${summary.date}\n${summary.summary}`);
    }
  }

  // Weekly summaries
  if (context.weeklySummaries.length > 0) {
    parts.push('## Weekly Summaries\n');
    for (const summary of context.weeklySummaries) {
      parts.push(`### ${summary.week_start} - ${summary.week_end}\n${summary.summary}`);
    }
  }

  return parts.join('\n\n');
}
