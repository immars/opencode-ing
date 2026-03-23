import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import type { SessionProvider } from './provider.js';
import type { SessionInfo, SessionQueryOptions } from './types.js';

function getClaudeCodeDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(home, '.claude');
}

function getHistoryPath(): string {
  return path.join(getClaudeCodeDir(), 'history.jsonl');
}

interface ClaudeHistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId: string;
}

export const claudeCodeSessionProvider: SessionProvider = {
  name: 'Claude Code',
  agentType: 'claude-code',

  isAvailable(): boolean {
    const claudeDir = getClaudeCodeDir();
    return fs.existsSync(claudeDir);
  },

  querySessions(options: SessionQueryOptions): SessionInfo[] {
    const historyPath = getHistoryPath();
    
    if (!fs.existsSync(historyPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(historyPath, 'utf-8');
      const lines = content.trim().split('\n');
      const entries: ClaudeHistoryEntry[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line) as ClaudeHistoryEntry;
          entries.push(entry);
        } catch {
        }
      }

      let filtered = entries;

      if (options.projectPath) {
        const absolutePath = path.resolve(options.projectPath);
        filtered = entries.filter(e => e.project === absolutePath);
      }

      filtered.sort((a, b) => b.timestamp - a.timestamp);

      const limited = filtered.slice(0, options.limit);

      const sessionCounts = new Map<string, number>();
      for (const entry of entries) {
        sessionCounts.set(entry.sessionId, (sessionCounts.get(entry.sessionId) || 0) + 1);
      }

      return limited.map((entry): SessionInfo => ({
        id: entry.sessionId,
        title: entry.display,
        projectPath: entry.project,
        messageCount: sessionCounts.get(entry.sessionId) || 1,
        createdAt: entry.timestamp,
        updatedAt: entry.timestamp,
      }));
    } catch (error) {
      console.error('[Claude Code] Failed to query sessions:', error);
      return [];
    }
  },
};
