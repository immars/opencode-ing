/**
 * L2 - Weekly Summary Module
 *
 * Handles weekly summary generation and storage
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { WeeklySummary } from './types.js';
import { DEFAULTS, L2_DIR } from './constants.js';
import { ensureMemoryDir, getMemoryFilePath, listMemoryFiles } from './utils.js';

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
