/**
 * L1 - Daily Summary Module
 *
 * Handles daily summary generation and storage
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { DailySummary } from './types.js';
import { MEMORY_ROOT_DIR, L1_DIR, DEFAULTS } from './constants.js';

/**
 * Get L1 directory path
 */
function getL1Dir(projectDir: string): string {
  return join(projectDir, MEMORY_ROOT_DIR, L1_DIR);
}

/**
 * Ensure L1 directory exists
 */
function ensureL1Dir(projectDir: string): void {
  const dir = getL1Dir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get L1 file path for a date
 */
function getL1FilePath(projectDir: string, date: string): string {
  return join(getL1Dir(projectDir), `${date}.md`);
}

/**
 * Write daily summary to L1
 */
export function writeDailySummary(projectDir: string, summary: DailySummary): void {
  ensureL1Dir(projectDir);
  const filePath = getL1FilePath(projectDir, summary.date);
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

/**
 * Read daily summary from L1
 * Returns the raw file content as summary for maximum flexibility
 */
export function readDailySummary(projectDir: string, date: string): DailySummary | null {
  const filePath = getL1FilePath(projectDir, date);
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

/**
 * Read multiple daily summaries (most recent first)
 */
export function readDailySummaries(projectDir: string, days: number = 3): DailySummary[] {
  const summaries: DailySummary[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const summary = readDailySummary(projectDir, dateStr);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}
