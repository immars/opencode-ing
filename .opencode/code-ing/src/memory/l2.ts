/**
 * L2 - Weekly Summary Module
 *
 * Handles weekly summary generation and storage
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import type { WeeklySummary } from './types.js';
import { MEMORY_ROOT_DIR, L2_DIR, DEFAULTS } from './constants.js';

/**
 * Get L2 directory path
 */
function getL2Dir(projectDir: string): string {
  return join(projectDir, MEMORY_ROOT_DIR, L2_DIR);
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
 * Uses local date components to avoid timezone issues
 */
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Get week end date (Sunday) for a given week start
 */
export function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
 * Returns the raw file content as summary for maximum flexibility
 */
export function readWeeklySummary(projectDir: string, weekStart: string): WeeklySummary | null {
  const filePath = getL2FilePath(projectDir, weekStart);
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

/**
 * Read multiple weekly summaries (most recent first)
 */
export function readWeeklySummaries(projectDir: string, count: number = 3): WeeklySummary[] {
  const dir = getL2Dir(projectDir);
  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir)
    .filter(f => f.endsWith('.md'))
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
