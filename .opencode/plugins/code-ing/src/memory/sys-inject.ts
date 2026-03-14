/**
 * SysInject - System Task Injection Module
 *
 * Handles variable substitution for CRON_SYS tasks:
 * - L0: L0 memory content to be compressed
 * - L1: L1 memory content
 * - L1_path: L1 file path for writing compressed L0
 * - L2_path: L2 file path for writing compressed L1
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { readRecentMessages } from './l0.js';
import { getWeekStart } from './l2.js';
import { L0_DIR, L1_DIR, L2_DIR, MEMORY_ROOT_DIR } from './constants.js';
import { 
  formatLocalDate, 
  getTodayString,
  ensureMemoryDir, 
  getMemoryDir, 
  getMemoryFilePath 
} from './utils.js';

export interface VariableContext {
  L0: string;
  L1: string;
  L1_path: string;
  L2_path: string;
}

export function getL0Content(projectDir: string): string {
  const today = getTodayString();
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
  const l1Dir = getMemoryDir(projectDir, L1_DIR);

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
  return getMemoryFilePath(projectDir, L1_DIR, `${getTodayString()}.md`);
}

export function getL2Path(projectDir: string): string {
  const weekStartStr = getWeekStart(new Date());
  return getMemoryFilePath(projectDir, L2_DIR, `${weekStartStr}.md`);
}

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
  const today = getTodayString();
  const weekStartStr = getWeekStart(new Date());

  ensureMemoryDir(projectDir, L0_DIR);
  ensureMemoryDir(projectDir, L1_DIR);
  ensureMemoryDir(projectDir, L2_DIR);

  const l0File = getMemoryFilePath(projectDir, L0_DIR, `${today}.md`);
  const l1File = getMemoryFilePath(projectDir, L1_DIR, `${today}.md`);
  const l2File = getMemoryFilePath(projectDir, L2_DIR, `${weekStartStr}.md`);

  for (const file of [l0File, l1File, l2File]) {
    if (!existsSync(file)) {
      writeFileSync(file, '');
    }
  }
}
