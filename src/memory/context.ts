/**
 * Context Module
 *
 * Handles memory context building and variable substitution for CRON_SYS tasks
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { MemoryContext, TriggerType } from './types.js';
import { 
  readAllL9,
  readTasks,
  readCron,
  readRecentMessages,
  readAllMessages,
  readDailySummaries,
  readWeeklySummaries,
  getWeekStart
} from './levels.js';
import { PATHS } from './constants.js';
import { 
  formatLocalDate, 
  getTodayString,
  getSessionL1Dir,
  getSessionL1FilePath,
  getSessionL2FilePath
} from './utils.js';

// ============================================================================
// Variable Substitution (from sys-inject)
// ============================================================================

export interface VariableContext {
  L0: string;
  L1: string;
  L1_path: string;
  L2_path: string;
}

export function getL0Content(projectDir: string, chatId: string): string {
  const today = getTodayString();
  const messages = readAllMessages(projectDir, today, chatId);
  
  if (messages.length === 0) {
    return '';
  }

  const contents: string[] = [];
  contents.push(`## ${today}`);
  for (const msg of messages) {
    contents.push(`- [${msg.timestamp}] ${msg.role}: ${msg.content}`);
  }

  return contents.join('\n');
}

export function getL1Content(projectDir: string, chatId: string): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const contents: string[] = [];
  const l1Dir = getSessionL1Dir(projectDir, chatId);

  for (let i = 0; i <= dayOfWeek; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const dateStr = formatLocalDate(date);
    const filePath = join(l1Dir, `${dateStr}.md`);

    if (existsSync(filePath)) {
      const fileContent = readFileSync(filePath, 'utf-8').trim();
      if (fileContent) {
        contents.push(`## ${dateStr}\n${fileContent}`);
      }
    }
  }

  return contents.join('\n\n');
}

export function getL1Path(projectDir: string, chatId: string): string {
  return getSessionL1FilePath(projectDir, chatId, getTodayString());
}

export function getL2Path(projectDir: string, chatId: string): string {
  const weekStartStr = getWeekStart(new Date());
  return getSessionL2FilePath(projectDir, chatId, weekStartStr);
}

export function buildVariableContext(projectDir: string, chatId: string): VariableContext {
  const L0 = getL0Content(projectDir, chatId);
  const L1 = getL1Content(projectDir, chatId);
  return {
    L0,
    L1,
    L1_path: getL1Path(projectDir, chatId),
    L2_path: getL2Path(projectDir, chatId),
  };
}

export function substituteVariables(
  content: string,
  variables: VariableContext
): string {
  let result = content;

  result = result.replace(/\{L0\}|\{L0_content\}/g, variables.L0);
  result = result.replace(/\{L1\}|\{L1_content\}/g, variables.L1);
  result = result.replace(/\{L1_path\}/g, variables.L1_path);
  result = result.replace(/\{L2_path\}/g, variables.L2_path);

  return result;
}

export function hasVariables(content: string): boolean {
  return /\{L0(_content)?\}|\{L1(_content)?\}|\{L1_path\}|\{L2_path\}/.test(content);
}

// ============================================================================
// Memory Context Building
// ============================================================================

export function getTaskContext(projectDir: string): string {
  const tasks = readTasks(projectDir);
  return tasks || 'No tasks defined';
}

export function getCronContext(projectDir: string, taskContent: string): string {
  const cron = readCron(projectDir);
  return cron || 'No cron tasks defined';
}

export function getCronSysContext(projectDir: string, taskContent: string, chatId?: string): string {
  if (!taskContent) {
    return 'No task content provided';
  }
  
  if (hasVariables(taskContent)) {
    const variables = buildVariableContext(projectDir, chatId || 'default');
    return substituteVariables(taskContent, variables);
  }
  
  return taskContent;
}

function getDirectoryInfo(projectDir: string): string {
  const lines: string[] = [];
  lines.push(`# Memory System`);
  lines.push(`- L0 (raw messages): ${PATHS.L0}/`);
  lines.push(`- L1 (daily summaries): ${PATHS.L1}/`);
  lines.push(`- L2 (weekly summaries): ${PATHS.L2}/`);
  lines.push(`- L9 (long-term): SOUL.md, PEOPLE.md, TASK.md, CRON.md, CRON_SYS.md`);
  return lines.join('\n');
}

export function buildMemoryContext(
  projectDir: string,
  triggerType: TriggerType,
  chatId: string
): MemoryContext {
  const longTermMemory = readAllL9(projectDir);
  const todayStr = getTodayString();
  const recentMessages = readRecentMessages(projectDir, todayStr, chatId, 60);
    const dailySummaries = readDailySummaries(projectDir, 3, chatId);
    const weeklySummaries = readWeeklySummaries(projectDir, 3, chatId);

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

export function getFeishuContext(projectDir: string, chatId: string): MemoryContext {
  return buildMemoryContext(projectDir, 'feishu_message', chatId);
}

export function getScheduledContext(projectDir: string, chatId: string): MemoryContext {
  return buildMemoryContext(projectDir, 'scheduled', chatId);
}

/**
 * Format CRON.md content for injection into chat session
 * Removes schedule and author fields, adds execution prefix
 */
export function formatCronForInjection(cronContent: string): string {
  if (!cronContent.trim()) {
    return '';
  }

  const sections = cronContent.split(/^# /m);
  const formattedTasks: string[] = [];

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split('\n');
    const title = lines[0].trim();

    let name = '';
    let description = '';
    let enabled = true;

    for (let line of lines.slice(1)) {
      let trimmed = line.trim();
      if (trimmed.startsWith('* ')) {
        trimmed = trimmed.substring(2);
      }

      if (trimmed.startsWith('name:')) {
        name = trimmed.substring(5).trim();
      } else if (trimmed.startsWith('description:') || trimmed.startsWith('descrption:')) {
        description = trimmed.substring(12).trim();
      } else if (trimmed.startsWith('enabled:')) {
        enabled = trimmed.substring(8).trim().toLowerCase() === 'true';
      }
    }

    if (name && enabled) {
      formattedTasks.push(`### ${name || title}`);
      if (description) {
        formattedTasks.push(description);
      }
    }
  }

  if (formattedTasks.length === 0) {
    return '';
  }

  return `现在执行以下任务：\n\n${formattedTasks.join('\n\n')}`;
}

export function formatContextAsPrompt(context: MemoryContext): string {
  const parts: string[] = [];

  if (context.longTermMemory.soul) {
    parts.push('## Agent Personality (SOUL)\n' + context.longTermMemory.soul);
  }

  if (context.longTermMemory.people) {
    parts.push('## User Profiles (PEOPLE)\n' + context.longTermMemory.people);
  }

  if (context.longTermMemory.tasks) {
    parts.push('## Current Tasks\n' + context.longTermMemory.tasks);
  }

  if (context.longTermMemory.cron) {
    const formattedCron = formatCronForInjection(context.longTermMemory.cron);
    if (formattedCron) {
      parts.push(formattedCron);
    }
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

// ============================================================================
// CRON_SYS Compression Prompt Builder
// ============================================================================

const COMPRESSION_INSTRUCTIONS = `把下列<detail></detail>标签中的信息进行压缩处理。

**压缩原则**：
1. 用语简洁，描述事实
2. 不超过500字
3. 尽量包括关键信息
4. 如果篇幅允许，尽量包括关键字，例如任务ID之类的信息

**输出格式**：把回复用<summary></summary>标签围起来。`;

/**
 * Build compression prompt for L1 (daily) summary
 */
export function buildL1CompressionPrompt(projectDir: string, chatId: string): string {
  const l0Content = getL0Content(projectDir, chatId);
  return `${COMPRESSION_INSTRUCTIONS}

<detail>
${l0Content}
</detail>`;
}

/**
 * Build compression prompt for L2 (weekly) summary
 */
export function buildL2CompressionPrompt(projectDir: string, chatId: string): string {
  const l1Content = getL1Content(projectDir, chatId);
  return `${COMPRESSION_INSTRUCTIONS}

<detail>
${l1Content}
</detail>`;
}

/**
 * Build compression prompt based on task type
 */
export function buildCompressionPrompt(projectDir: string, taskType: 'L1' | 'L2', chatId: string): string {
  if (taskType === 'L1') {
    return buildL1CompressionPrompt(projectDir, chatId);
  }
  return buildL2CompressionPrompt(projectDir, chatId);
}

/**
 * Extract content from <summary> tags in agent response
 */
export function extractSummary(responseText: string): string | null {
  const match = responseText.match(/<summary>([\s\S]*?)<\/summary>/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}
