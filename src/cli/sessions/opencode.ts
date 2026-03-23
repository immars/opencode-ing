import path from 'node:path';
import fs from 'node:fs';
import BetterSQLite3 from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
import type { SessionProvider } from './provider.js';
import type { SessionInfo, SessionQueryOptions } from './types.js';

interface OpenCodeSessionRow {
  id: string;
  title: string;
  directory: string;
  time_created: number;
  time_updated: number;
  message_count: number;
}

function getOpenCodeDbPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(home, '.local', 'share', 'opencode', 'opencode.db');
}

export function getLatestSessionId(projectPath: string): string | null {
  const dbPath = getOpenCodeDbPath();
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  let db: Database | null = null;
  try {
    db = new BetterSQLite3(dbPath, { readonly: true });
    const absolutePath = path.resolve(projectPath);
    
    const stmt = db.prepare(`
      SELECT id FROM session 
      WHERE directory = ? 
      ORDER BY time_updated DESC 
      LIMIT 1
    `);
    
    const row = stmt.get(absolutePath) as { id: string } | undefined;
    return row?.id || null;
  } catch {
    return null;
  } finally {
    if (db) {
      db.close();
    }
  }
}

export const openCodeSessionProvider: SessionProvider = {
  name: 'OpenCode',
  agentType: 'opencode',

  isAvailable(): boolean {
    const dbPath = getOpenCodeDbPath();
    return fs.existsSync(dbPath);
  },

  querySessions(options: SessionQueryOptions): SessionInfo[] {
    const dbPath = getOpenCodeDbPath();
    let db: Database | null = null;

    try {
      db = new BetterSQLite3(dbPath, { readonly: true });

      let query = `
        SELECT 
          s.id,
          s.title,
          s.directory,
          s.time_created,
          s.time_updated,
          (SELECT COUNT(*) FROM message m WHERE m.session_id = s.id) as message_count
        FROM session s
      `;

      const params: (string | number)[] = [];

      if (options.projectPath) {
        const absolutePath = path.resolve(options.projectPath);
        query += ` WHERE s.directory = ?`;
        params.push(absolutePath);
      }

      query += ` ORDER BY s.time_updated DESC LIMIT ?`;
      params.push(options.limit);

      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as OpenCodeSessionRow[];

      return rows.map((row): SessionInfo => ({
        id: row.id,
        title: row.title,
        projectPath: row.directory,
        messageCount: row.message_count,
        createdAt: row.time_created,
        updatedAt: row.time_updated,
      }));
    } catch (error) {
      console.error('[OpenCode] Failed to query sessions:', error);
      return [];
    } finally {
      if (db) {
        db.close();
      }
    }
  },
};
