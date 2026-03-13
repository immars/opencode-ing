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
import { buildVariableContext, substituteVariables, type VariableContext } from './sys-inject.js';

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

/**
 * Build context for TASK trigger
 * Inject: workspace root + SOUL.md, PEOPLE.md, TASK.md + current datetime
 */
export function getTaskContext(projectDir: string): string {
  const soul = readSoul(projectDir);
  const people = readPeople(projectDir);
  const tasks = readTasks(projectDir);
  const now = new Date().toISOString();

  const parts: string[] = [];

  parts.push('# Scheduled Task Execution');
  parts.push(`Current DateTime: ${now}`);
  parts.push('');

  if (soul) {
    parts.push('## Agent Personality (SOUL)');
    parts.push(soul);
    parts.push('');
  }

  if (people) {
    parts.push('## User Profiles (PEOPLE)');
    parts.push(people);
    parts.push('');
  }

  if (tasks) {
    parts.push('## Current Tasks (TASK.md)');
    parts.push(tasks);
    parts.push('');
  }

  parts.push('Please execute the task(s) listed in TASK.md.');
  parts.push('Remember to update TASK.md with the completion status after finishing.');

  return parts.join('\n');
}

/**
 * Build context for CRON trigger
 * Inject: workspace root + SOUL.md, PEOPLE.md, CRON.md matching entries + datetime
 */
export function getCronContext(projectDir: string, matchedTaskContent: string): string {
  const soul = readSoul(projectDir);
  const people = readPeople(projectDir);
  const now = new Date().toISOString();

  const parts: string[] = [];

  parts.push('# Scheduled Cron Task Execution');
  parts.push(`Current DateTime: ${now}`);
  parts.push('');

  if (soul) {
    parts.push('## Agent Personality (SOUL)');
    parts.push(soul);
    parts.push('');
  }

  if (people) {
    parts.push('## User Profiles (PEOPLE)');
    parts.push(people);
    parts.push('');
  }

  if (matchedTaskContent) {
    parts.push('## Scheduled Task');
    parts.push(matchedTaskContent);
    parts.push('');
  }

  parts.push('Please execute the scheduled task above.');

  return parts.join('\n');
}

/**
 * Build context for CRON_SYS trigger
 * Inject: SOUL.md, PEOPLE.md, single CRON_SYS task entry + variable substitution
 */
export function getCronSysContext(projectDir: string, taskContent: string): string {
  const soul = readSoul(projectDir);
  const people = readPeople(projectDir);

  const variableContext = buildVariableContext(projectDir);
  const substitutedContent = substituteVariables(taskContent, variableContext);

  const parts: string[] = [];

  parts.push('# System Cron Task Execution');
  parts.push(`Current DateTime: ${new Date().toISOString()}`);
  parts.push('');

  if (soul) {
    parts.push('## Agent Personality (SOUL)');
    parts.push(soul);
    parts.push('');
  }

  if (people) {
    parts.push('## User Profiles (PEOPLE)');
    parts.push(people);
    parts.push('');
  }

  parts.push('## System Task');
  parts.push(substitutedContent);
  parts.push('');

  parts.push('Please execute the system task above.');
  parts.push('Variable context for compression:');
  parts.push(`- L1_path: ${variableContext.L1_path}`);
  parts.push(`- L2_path: ${variableContext.L2_path}`);

  return parts.join('\n');
}

function buildBaseContext(projectDir: string, title: string): { parts: string[]; now: string } {
  const soul = readSoul(projectDir);
  const people = readPeople(projectDir);
  const now = new Date().toISOString();

  const parts: string[] = [];
  parts.push(`# ${title}`);
  parts.push(`Current DateTime: ${now}`);
  parts.push('');

  if (soul) {
    parts.push('## Agent Personality (SOUL)');
    parts.push(soul);
    parts.push('');
  }

  if (people) {
    parts.push('## User Profiles (PEOPLE)');
    parts.push(people);
    parts.push('');
  }

  return { parts, now };
}
