/**
 * SysInject - System Task Injection Module
 *
 * Handles variable substitution for CRON_SYS tasks:
 * - L0: L0 memory content to be compressed
 * - L1: L1 memory content
 * - L1_path: L1 file path for writing compressed L0
 * - L2_path: L2 file path for writing compressed L1
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { readRecentMessages } from './l0.js';
import { readDailySummaries } from './l1.js';
import { readWeeklySummaries } from './l2.js';
import { PATHS, MEMORY_ROOT_DIR, L1_DIR, L2_DIR, L0_DIR } from './constants.js';

export interface VariableContext {
  L0: string;
  L1: string;
  L1_path: string;
  L2_path: string;
}

/**
 * Get L0 memory content to be compressed
 */
export function getL0Content(projectDir: string): string {
  const today = new Date();
  const contents: string[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const messages = readRecentMessages(projectDir, dateStr, 60);
    if (messages.length > 0) {
      contents.push(`## ${dateStr}`);
      for (const msg of messages) {
        contents.push(`- [${msg.timestamp}] ${msg.role}: ${msg.content}`);
      }
    }
  }

  return contents.join('\n');
}

/**
 * Get L1 memory content
 */
export function getL1Content(projectDir: string): string {
  const summaries = readDailySummaries(projectDir, 7);
  const contents: string[] = [];

  for (const summary of summaries) {
    contents.push(`## ${summary.date}`);
    contents.push(`Topics: ${summary.topics.join(', ')}`);
    contents.push(`Summary: ${summary.summary}`);
  }

  return contents.join('\n');
}

/**
 * Get L1 file path for writing compressed L0
 */
export function getL1Path(projectDir: string): string {
  const today = new Date().toISOString().split('T')[0];
  return join(projectDir, MEMORY_ROOT_DIR, L1_DIR, `${today}.md`);
}

/**
 * Get L2 file path for writing compressed L1
 */
export function getL2Path(projectDir: string): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  return join(projectDir, MEMORY_ROOT_DIR, L2_DIR, `${weekStartStr}.md`);
}

/**
 * Build variable context for CRON_SYS task substitution
 */
export function buildVariableContext(projectDir: string): VariableContext {
  return {
    L0: getL0Content(projectDir),
    L1: getL1Content(projectDir),
    L1_path: getL1Path(projectDir),
    L2_path: getL2Path(projectDir),
  };
}

/**
 * Perform variable substitution on task content
 * Variables are wrapped in { } brackets
 */
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

export function ensureMemoryPaths(projectDir: string): void {
  const today = new Date().toISOString().split('T')[0];
  
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const dirs = [
    join(projectDir, MEMORY_ROOT_DIR, L0_DIR),
    join(projectDir, MEMORY_ROOT_DIR, L1_DIR),
    join(projectDir, MEMORY_ROOT_DIR, L2_DIR),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const l0File = join(projectDir, MEMORY_ROOT_DIR, L0_DIR, `${today}.md`);
  const l1File = join(projectDir, MEMORY_ROOT_DIR, L1_DIR, `${today}.md`);
  const l2File = join(projectDir, MEMORY_ROOT_DIR, L2_DIR, `${weekStartStr}.md`);

  for (const file of [l0File, l1File, l2File]) {
    if (!existsSync(file)) {
      writeFileSync(file, '');
    }
  }
}
