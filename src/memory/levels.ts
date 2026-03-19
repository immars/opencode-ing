/**
 * Memory Levels Module
 *
 * Consolidates L0, L1, L2, L9 memory operations:
 * - L0: Raw message records (L0/{date}.md)
 * - L1: Daily summaries (L1/{date}.md)
 * - L2: Weekly summaries (L2/{date}.md)
 * - L9: Long-term memory files (SOUL.md, PEOPLE.md, TASK.md, CRON.md, CRON_SYS.md)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { DEFAULTS, L0_DIR, L1_DIR, L2_DIR, L9_FILES } from './constants.js';
import { 
  ensureMemoryDir, 
  getMemoryFilePath, 
  listMemoryFiles,
  readMemoryRootFile,
  writeMemoryRootFile,
  getSessionL0FilePath,
  ensureSessionL0Dir,
  getSessionL1FilePath,
  ensureSessionL1Dir,
  listSessionL1Files,
  getSessionL2FilePath,
  ensureSessionL2Dir,
  listSessionL2Files,
  listSessionL0Files
} from './utils.js';
import { getGlobalSoulPath, getSessionL9FilePath, getSessionDir, getGlobalDir, listAllSessions } from './paths.js';
import type { MessageRecord, DailySummary, WeeklySummary } from './types.js';

// ============================================================================
// L9 - Long-term Memory (SOUL, PEOPLE, TASK, CRON, CRON_SYS)
// ============================================================================

type L9FileName = typeof L9_FILES[keyof typeof L9_FILES];

function readL9File(projectDir: string, filename: L9FileName): string {
  return readMemoryRootFile(projectDir, filename);
}

function writeL9File(projectDir: string, filename: L9FileName, content: string): void {
  writeMemoryRootFile(projectDir, filename, content);
}

export function readSoul(projectDir: string): string {
  return readL9File(projectDir, L9_FILES.SOUL);
}

export function writeSoul(projectDir: string, content: string): void {
  writeL9File(projectDir, L9_FILES.SOUL, content);
}

export function readPeople(projectDir: string): string {
  return readL9File(projectDir, L9_FILES.PEOPLE);
}

export function writePeople(projectDir: string, content: string): void {
  writeL9File(projectDir, L9_FILES.PEOPLE, content);
}

export function readTasks(projectDir: string): string {
  return readL9File(projectDir, L9_FILES.TASK);
}

export function writeTasks(projectDir: string, content: string): void {
  writeL9File(projectDir, L9_FILES.TASK, content);
}

export function readCron(projectDir: string): string {
  return readL9File(projectDir, L9_FILES.CRON);
}

export function writeCron(projectDir: string, content: string): void {
  writeL9File(projectDir, L9_FILES.CRON, content);
}

export function readCronSys(projectDir: string): string {
  return readL9File(projectDir, L9_FILES.CRON_SYS);
}

export function writeCronSys(projectDir: string, content: string): void {
  writeL9File(projectDir, L9_FILES.CRON_SYS, content);
}

// Per-session L9 file operations

export function readSessionTasks(projectDir: string, chatId: string): string {
  const filePath = getSessionL9FilePath(projectDir, chatId, L9_FILES.TASK);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

export function readSessionCron(projectDir: string, chatId: string): string {
  const filePath = getSessionL9FilePath(projectDir, chatId, L9_FILES.CRON);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

export function readSessionCronSys(projectDir: string, chatId: string): string {
  const filePath = getSessionL9FilePath(projectDir, chatId, L9_FILES.CRON_SYS);
  if (!existsSync(filePath)) {
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

export function readAllL9(projectDir: string): {
  soul: string;
  people: string;
  tasks: string;
  cron: string;
  cronSys: string;
} {
  return {
    soul: readSoul(projectDir),
    people: readPeople(projectDir),
    tasks: readTasks(projectDir),
    cron: readCron(projectDir),
    cronSys: readCronSys(projectDir),
  };
}

// ============================================================================
// L0 - Raw Message Records
// ============================================================================

export function writeMessageRecord(
  projectDir: string,
  date: string,
  message: MessageRecord,
  chatId: string
): void {
  ensureSessionL0Dir(projectDir, chatId);

  const filePath = getSessionL0FilePath(projectDir, chatId, date);
  const recordLine = `- [${message.timestamp}] ${message.role}: ${message.content}`;

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8');
    writeFileSync(filePath, `${existing}\n${recordLine}`);
  } else {
    writeFileSync(filePath, `# L0 Messages - ${date}\n\n${recordLine}\n`);
  }
}

export function readRecentMessages(
  projectDir: string,
  date: string,
  chatId: string,
  minCount: number = DEFAULTS.L0_MAX_MESSAGES
): MessageRecord[] {
  const todayMessages = readMessagesFromFile(projectDir, chatId, date);
  
  if (todayMessages.length >= minCount) {
    return todayMessages;
  }
  
  const neededFromHistory = minCount - todayMessages.length;
  const historicalMessages = readHistoricalMessages(projectDir, chatId, date, neededFromHistory);
  
  return [...historicalMessages, ...todayMessages];
}

function parseMessagesFromFile(filePath: string): MessageRecord[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim().startsWith('- ['));

  const messages: MessageRecord[] = [];
  for (const line of lines) {
    const match = line.match(/^- \[([^\]]+)\] (user|assistant): (.*)$/);
    if (match) {
      const [, timestamp, role, msgContent] = match;
      messages.push({
        timestamp,
        role: role as 'user' | 'assistant',
        content: msgContent,
        source: 'feishu',
      });
    }
  }
  return messages;
}

function readMessagesFromFile(projectDir: string, chatId: string, date: string): MessageRecord[] {
  const filePath = getSessionL0FilePath(projectDir, chatId, date);
  return parseMessagesFromFile(filePath);
}

function readHistoricalMessages(
  projectDir: string,
  chatId: string,
  todayDate: string,
  neededCount: number
): MessageRecord[] {
  const allFiles = listSessionL0Files(projectDir, chatId, '.md');
  const allHistorical: MessageRecord[] = [];

  for (const file of allFiles) {
    if (file === `${todayDate}.md`) continue;

    const fileDate = file.replace('.md', '');
    const chronologicalMessages = readMessagesFromFile(projectDir, chatId, fileDate);
    const newestFromThisFile = chronologicalMessages.slice(-neededCount);
    allHistorical.unshift(...newestFromThisFile);
    
    if (allHistorical.length >= neededCount) {
      break;
    }
  }

  return allHistorical.slice(-neededCount);
}

export function readAllMessages(projectDir: string, date: string, chatId: string): MessageRecord[] {
  return readMessagesFromFile(projectDir, chatId, date);
}

// ============================================================================
// L1 - Daily Summaries
// ============================================================================

export function writeDailySummary(projectDir: string, summary: DailySummary, chatId: string): void {
  ensureSessionL1Dir(projectDir, chatId);
  const filePath = getSessionL1FilePath(projectDir, chatId, summary.date);
  const content = `# Daily Summary - ${summary.date}

## Topics
${summary.topics.map((t) => `- ${t}`).join('\n')}

## Summary
${summary.summary}

---
*Max bytes: ${summary.max_bytes}*
`;
  writeFileSync(filePath, content);
}

export function readDailySummary(projectDir: string, date: string, chatId: string): DailySummary | null {
  const filePath = getSessionL1FilePath(projectDir, chatId, date);
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  return {
    date,
    topics: [],
    summary: content.trim(),
    max_bytes: DEFAULTS.L1_SUMMARY_MAX_BYTES,
  };
}

export function readDailySummaries(projectDir: string, count: number, chatId: string): DailySummary[] {
  const files = listSessionL1Files(projectDir, chatId, '.md')
    .sort()
    .reverse()
    .slice(0, count);

  const summaries: DailySummary[] = [];
  for (const file of files) {
    const date = file.replace('.md', '');
    const summary = readDailySummary(projectDir, date, chatId);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}

// ============================================================================
// L2 - Weekly Summaries
// ============================================================================

export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function writeWeeklySummary(projectDir: string, summary: WeeklySummary, chatId: string): void {
  ensureSessionL2Dir(projectDir, chatId);
  const filePath = getSessionL2FilePath(projectDir, chatId, summary.week_start);
  const content = `# Weekly Summary - ${summary.week_start} to ${summary.week_end}

## Topics
${summary.topics.map((t) => `- ${t}`).join('\n')}

## Summary
${summary.summary}

---
*Week: ${summary.week_start} - ${summary.week_end}*
*Max bytes: ${summary.max_bytes}*
`;
  writeFileSync(filePath, content);
}

export function readWeeklySummary(projectDir: string, weekStart: string, chatId: string): WeeklySummary | null {
  const filePath = getSessionL2FilePath(projectDir, chatId, weekStart);
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const weekEnd = getWeekEnd(weekStart);
  return {
    week_start: weekStart,
    week_end: weekEnd,
    topics: [],
    summary: content.trim(),
    max_bytes: DEFAULTS.L2_SUMMARY_MAX_BYTES,
  };
}

export function readWeeklySummaries(projectDir: string, count: number, chatId: string): WeeklySummary[] {
  const files = listSessionL2Files(projectDir, chatId, '.md')
    .sort()
    .reverse()
    .slice(0, count);

  const summaries: WeeklySummary[] = [];
  for (const file of files) {
    const weekStart = file.replace('.md', '');
    const summary = readWeeklySummary(projectDir, weekStart, chatId);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}
