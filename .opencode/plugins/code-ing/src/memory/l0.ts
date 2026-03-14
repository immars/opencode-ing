/**
 * L0 - Message Records Module
 *
 * Handles raw message storage in L0/{date}.md
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { DEFAULTS, L0_DIR } from './constants.js';
import { ensureMemoryDir, getMemoryFilePath } from './utils.js';
import type { MessageRecord } from './types.js';

export function writeMessageRecord(
  projectDir: string,
  date: string,
  message: MessageRecord
): void {
  ensureMemoryDir(projectDir, L0_DIR);

  const filePath = getMemoryFilePath(projectDir, L0_DIR, `${date}.md`);
  const recordLine = `- [${message.timestamp}] ${message.role}: ${message.content}`;

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8');
    writeFileSync(filePath, `${existing}\n${recordLine}`);
  } else {
    writeFileSync(filePath, `# L0 Messages - ${date}\n\n${recordLine}\n`);
  }
}

export function readRecentMessages(
  projectDir: string,
  date: string,
  count: number = DEFAULTS.L0_MAX_MESSAGES
): MessageRecord[] {
  const filePath = getMemoryFilePath(projectDir, L0_DIR, `${date}.md`);

  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim().startsWith('- ['));

  const messages: MessageRecord[] = [];
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

export function readAllMessages(projectDir: string, date: string): MessageRecord[] {
  return readRecentMessages(projectDir, date, Infinity);
}
