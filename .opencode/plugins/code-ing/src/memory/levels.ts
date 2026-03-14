/**
 * Memory Levels Module
 *
 * Consolidates L0, L1, L2, L9 memory operations:
 * - L0: Raw message records (L0/{date}.md)
 * - L1: Daily summaries (L1/{date}.md)
 * - L2: Weekly summaries (L2/{date}.md)
 * - L9: Long-term memory files (SOUL.md, PEOPLE.md, TASK.md, CRON.md, CRON_SYS.md)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { DEFAULTS, L0_DIR, L1_DIR, L2_DIR, L9_FILES } from './constants.js';
import { 
  ensureMemoryDir, 
  getMemoryFilePath, 
  listMemoryFiles,
  readMemoryRootFile,
  writeMemoryRootFile 
} from './utils.js';
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
  message: MessageRecord
): void {
  ensureMemoryDir(projectDir, L0_DIR);

  const filePath = getMemoryFilePath(projectDir, L0_DIR, `${date}.md`);
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
  count: number = DEFAULTS.L0_MAX_MESSAGES
): MessageRecord[] {
  const filePath = getMemoryFilePath(projectDir, L0_DIR, `${date}.md`);

  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim().startsWith('- ['));

  const messages: MessageRecord[] = [];
  const recentLines = lines.slice(-count);

  for (const line of recentLines) {
    const match = line.match(/^- \[([^\]]+)\] (user|assistant): (.*)$/);
    if (match) {
      const [, timestamp, role, content] = match;
      messages.push({
        timestamp,
        role: role as 'user' | 'assistant',
        content,
        source: 'feishu',
      });
    }
  }

  return messages;
}

export function readAllMessages(projectDir: string, date: string): MessageRecord[] {
  return readRecentMessages(projectDir, date, Infinity);
}

// ============================================================================
// L1 - Daily Summaries
// ============================================================================

export function writeDailySummary(projectDir: string, summary: DailySummary): void {
  ensureMemoryDir(projectDir, L1_DIR);
  const filePath = getMemoryFilePath(projectDir, L1_DIR, `${summary.date}.md`);
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

export function readDailySummary(projectDir: string, date: string): DailySummary | null {
  const filePath = getMemoryFilePath(projectDir, L1_DIR, `${date}.md`);
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

export function readDailySummaries(projectDir: string, count: number = 3): DailySummary[] {
  const files = listMemoryFiles(projectDir, L1_DIR, '.md')
    .sort()
    .reverse()
    .slice(0, count);

  const summaries: DailySummary[] = [];
  for (const file of files) {
    const date = file.replace('.md', '');
    const summary = readDailySummary(projectDir, date);
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

export function writeWeeklySummary(projectDir: string, summary: WeeklySummary): void {
  ensureMemoryDir(projectDir, L2_DIR);
  const filePath = getMemoryFilePath(projectDir, L2_DIR, `${summary.week_start}.md`);
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

export function readWeeklySummary(projectDir: string, weekStart: string): WeeklySummary | null {
  const filePath = getMemoryFilePath(projectDir, L2_DIR, `${weekStart}.md`);
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

export function readWeeklySummaries(projectDir: string, count: number = 3): WeeklySummary[] {
  const files = listMemoryFiles(projectDir, L2_DIR, '.md')
    .sort()
    .reverse()
    .slice(0, count);

  const summaries: WeeklySummary[] = [];
  for (const file of files) {
    const weekStart = file.replace('.md', '');
    const summary = readWeeklySummary(projectDir, weekStart);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}
