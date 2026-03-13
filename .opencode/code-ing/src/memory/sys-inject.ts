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
import { PATHS, MEMORY_ROOT_DIR, L1_DIR, L2_DIR, L0_DIR } from './constants.js';

export interface VariableContext {
  L0: string;
  L1: string;
  L1_path: string;
  L2_path: string;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getL0Content(projectDir: string): string {
  const today = formatLocalDate(new Date());
  const messages = readRecentMessages(projectDir, today, 60);
  
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

export function getL1Content(projectDir: string): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const contents: string[] = [];
  const l1Dir = join(projectDir, MEMORY_ROOT_DIR, L1_DIR);

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

export function getL1Path(projectDir: string): string {
  const today = formatLocalDate(new Date());
  return join(projectDir, MEMORY_ROOT_DIR, L1_DIR, `${today}.md`);
}

export function getL2Path(projectDir: string): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStartStr = formatLocalDate(weekStart);

  return join(projectDir, MEMORY_ROOT_DIR, L2_DIR, `${weekStartStr}.md`);
}

/**
 * Build variable context for CRON_SYS task substitution
 */
export function buildVariableContext(projectDir: string): VariableContext {
  const L0 = getL0Content(projectDir);
  const L1 = getL1Content(projectDir);
  return {
    L0,
    L1,
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
  const today = formatLocalDate(new Date());
  
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStartStr = formatLocalDate(weekStart);

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
