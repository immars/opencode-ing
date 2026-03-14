/**
 * L1 - Daily Summary Module
 *
 * Handles daily summary generation and storage
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { DailySummary } from './types.js';
import { DEFAULTS, L1_DIR } from './constants.js';
import { ensureMemoryDir, getMemoryFilePath, listMemoryFiles } from './utils.js';

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
