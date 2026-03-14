/**
 * L0 - Message Records Module
 *
 * Handles raw message storage in L0/{date}.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PATHS, DEFAULTS } from './constants.js';
import type { MessageRecord } from './types.js';

/**
 * Get the L0 directory path for a project
 */
function getL0Dir(projectDir: string): string {
  return join(projectDir, PATHS.L0);
}

/**
 * Ensure L0 directory exists
 */
function ensureL0Dir(projectDir: string): void {
  const dir = getL0Dir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get the L0 file path for a specific date
 */
function getL0FilePath(projectDir: string, date: string): string {
  return join(getL0Dir(projectDir), `${date}.md`);
}

/**
 * Write a message record to L0/{date}.md
 */
export function writeMessageRecord(
  projectDir: string,
  date: string,
  message: MessageRecord
): void {
  ensureL0Dir(projectDir);

  const filePath = getL0FilePath(projectDir, date);
  const recordLine = `- [${message.timestamp}] ${message.role}: ${message.content}`;

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8');
    writeFileSync(filePath, `${existing}\n${recordLine}`);
  } else {
    writeFileSync(filePath, `# L0 Messages - ${date}\n\n${recordLine}\n`);
  }
}

/**
 * Read recent messages from L0/{date}.md
 */
export function readRecentMessages(
  projectDir: string,
  date: string,
  count: number = DEFAULTS.L0_MAX_MESSAGES
): MessageRecord[] {
  const filePath = getL0FilePath(projectDir, date);

  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim().startsWith('- ['));

  const messages: MessageRecord[] = [];

  // Get the most recent N messages (from the end of the file)
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

/**
 * Read all messages from L0/{date}.md
 */
export function readAllMessages(projectDir: string, date: string): MessageRecord[] {
  return readRecentMessages(projectDir, date, Infinity);
}
