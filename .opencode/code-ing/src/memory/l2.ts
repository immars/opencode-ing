/**
 * L2 - Weekly Summary Module
 *
 * Handles weekly summary generation and storage
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { WeeklySummary } from './types.js';
import { MEMORY_DIR, L2_DIR, DEFAULTS } from './constants.js';

/**
 * Get L2 directory path
 */
function getL2Dir(projectDir: string): string {
  return join(projectDir, MEMORY_DIR, L2_DIR);
}

/**
 * Ensure L2 directory exists
 */
function ensureL2Dir(projectDir: string): void {
  const dir = getL2Dir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get L2 file path for a week
 */
function getL2FilePath(projectDir: string, weekStart: string): string {
  return join(getL2Dir(projectDir), `${weekStart}.md`);
}

/**
 * Get week start date (Monday) for a given date
 */
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/**
 * Get week end date (Sunday) for a given week start
 */
export function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

/**
 * Write weekly summary to L2
 */
export function writeWeeklySummary(projectDir: string, summary: WeeklySummary): void {
  ensureL2Dir(projectDir);
  const filePath = getL2FilePath(projectDir, summary.week_start);
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

/**
 * Read weekly summary from L2
 */
export function readWeeklySummary(projectDir: string, weekStart: string): WeeklySummary | null {
  const filePath = getL2FilePath(projectDir, weekStart);
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  return parseWeeklySummary(weekStart, content);
}

/**
 * Parse weekly summary content
 */
function parseWeeklySummary(weekStart: string, content: string): WeeklySummary {
  const topics: string[] = [];
  let summary = '';
  const weekEnd = getWeekEnd(weekStart);

  const lines = content.split('\n');
  let inTopics = false;
  let inSummary = false;

  for (const line of lines) {
    if (line.startsWith('## Topics')) {
      inTopics = true;
      inSummary = false;
      continue;
    }
    if (line.startsWith('## Summary')) {
      inTopics = false;
      inSummary = true;
      continue;
    }
    if (line.startsWith('---')) {
      inSummary = false;
      continue;
    }

    if (inTopics && line.startsWith('- ')) {
      topics.push(line.substring(2));
    }
    if (inSummary && line.trim()) {
      summary += line + '\n';
    }
  }

  return {
    week_start: weekStart,
    week_end: weekEnd,
    topics,
    summary: summary.trim(),
    max_bytes: DEFAULTS.L2_SUMMARY_MAX_BYTES,
  };
}

/**
 * Read multiple weekly summaries (most recent first)
 */
export function readWeeklySummaries(projectDir: string, weeks: number = 3): WeeklySummary[] {
  const summaries: WeeklySummary[] = [];
  const today = new Date();

  for (let i = 0; i < weeks; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i * 7);
    const weekStart = getWeekStart(date);

    const summary = readWeeklySummary(projectDir, weekStart);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}
