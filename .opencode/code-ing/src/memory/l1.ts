/**
 * L1 - Daily Summary Module
 *
 * Handles daily summary generation and storage
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { DailySummary } from './types.js';
import { L1_DIR, DEFAULTS } from './constants.js';
import { getMemoryDir, ensureMemoryDir, getMemoryFilePath } from './utils.js';

function getL1Dir(projectDir: string): string {
  return getMemoryDir(projectDir, L1_DIR);
}

function ensureL1Dir(projectDir: string): void {
  ensureMemoryDir(projectDir, L1_DIR);
}

function getL1FilePath(projectDir: string, date: string): string {
  return getMemoryFilePath(projectDir, L1_DIR, `${date}.md`);
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
 */
export function readDailySummary(projectDir: string, date: string): DailySummary | null {
  const filePath = getL1FilePath(projectDir, date);
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  return parseDailySummary(date, content);
}

/**
 * Parse daily summary content
 */
function parseDailySummary(date: string, content: string): DailySummary {
  const topics: string[] = [];
  let summary = '';

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
    date,
    topics,
    summary: summary.trim(),
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
    const dateStr = date.toISOString().split('T')[0];

    const summary = readDailySummary(projectDir, dateStr);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}
