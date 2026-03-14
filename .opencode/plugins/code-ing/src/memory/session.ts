/**
 * Session - Session Maintenance Module
 *
 * Manages OpenCode session lifecycle
 */

import { DEFAULTS } from './constants.js';
import { getFeishuContext, formatContextAsPrompt } from './context.js';
import { logger } from '../logger.js';

const MANAGED_SESSION_NAME = 'Assistant Managed Session';
const AGENT_NAME = 'assistant';
const SESSION_MAX_AGE_HOURS = DEFAULTS.SESSION_MAX_AGE_HOURS;
const SESSION_MAX_KEEP = DEFAULTS.SESSION_MAX_KEEP;

interface SessionInfo {
  id: string;
  title: string;
  created_at: string;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
}

function getSessionAgeHours(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
}

function shouldRotateByAge(createdAt: string): boolean {
  return getSessionAgeHours(createdAt) >= SESSION_MAX_AGE_HOURS;
}

function shouldRotateByTokens(session: SessionInfo): boolean {
  if (!session.total_tokens) return false;
  const CONTEXT_WINDOW = 128000;
  const THRESHOLD = 0.8;
  return session.total_tokens >= CONTEXT_WINDOW * THRESHOLD;
}

export async function housekeepSessions(
  client: any,
  prefix: string,
  maxKeep: number = 5
): Promise<void> {
  try {
    const sessionsResp = await client.session.list();
    const allSessions = sessionsResp?.data || [];

    const matched = allSessions
      .filter((s: any) => s.title?.startsWith(prefix))
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const toDelete = matched.slice(maxKeep);

    if (toDelete.length > 0) {
      logger.info('Session', `Housekeeping "${prefix}": ${matched.length} found, deleting ${toDelete.length}`);
    }

    for (const session of toDelete) {
      try {
        await client.session.delete({
          path: { id: session.id },
        });
        logger.info('Session', 'Deleted:', session.title);
      } catch (e) {
        logger.error('Session', 'Failed to delete:', session.title, e);
      }
    }
  } catch (err) {
    logger.error('Session', 'Housekeeping failed:', err);
  }
}

/**
 * Get or create a managed session
 * 
 * Auto-rotates when:
 * - Session age >= 6 hours
 * - Token usage >= 80% of context window
 * 
 * Uses housekeeping to keep only latest 5 sessions
 */
export async function getOrCreateManagedSession(
  client: any,
  directory?: string
): Promise<string | null> {
  try {
    const sessionsResp = await client.session.list();
    const allSessions = sessionsResp?.data || [];

    const currentSessions = allSessions.filter(
      (s: SessionInfo) => s.title === MANAGED_SESSION_NAME
    );

    if (currentSessions.length > 0) {
      const session = currentSessions[0];
      const needsRotation = shouldRotateByAge(session.created_at) || shouldRotateByTokens(session);

      if (needsRotation) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const newTitle = `${MANAGED_SESSION_NAME} ${timestamp}`;
        
        await client.session.update({
          path: { id: session.id },
          body: { title: newTitle },
        });
        
        logger.info('Session', 'Rotated:', session.id, '->', newTitle);
        await housekeepSessions(client, MANAGED_SESSION_NAME, SESSION_MAX_KEEP);
      } else {
        return session.id;
      }
    }

    const newSession = await client.session.create({
      body: { title: MANAGED_SESSION_NAME },
    });

    const newSessionId = newSession.data?.id;
    if (newSessionId) {
      logger.info('Session', 'Created new managed session:', newSessionId);
      
      if (directory) {
        const memoryContext = getFeishuContext(directory);
        const contextPrompt = formatContextAsPrompt(memoryContext);
        
        if (contextPrompt) {
          await client.session.prompt({
            path: { id: newSessionId },
            body: {
              agent: AGENT_NAME,
              parts: [{ type: 'text', text: `[System Context]\n\n${contextPrompt}` }],
            },
          });
        }
      }
      
      return newSessionId;
    }

    logger.error('Session', 'Failed to create session: no ID returned');
    return null;
  } catch (err) {
    logger.error('Session', 'Failed to get or create managed session:', err);
    return null;
  }
}

/**
 * Check if a session should be rotated
 */
export function shouldRotateSession(
  createdAt: Date,
  maxAgeDays: number = DEFAULTS.SESSION_MAX_AGE_DAYS
): boolean {
  const now = new Date();
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays > maxAgeDays;
}

/**
 * Rotate old sessions - rename with .1, .2 suffix
 */
export async function rotateOldSessions(
  client: any,
  maxAgeDays: number = DEFAULTS.SESSION_MAX_AGE_DAYS,
  maxRolling: number = DEFAULTS.SESSION_MAX_ROLLING
): Promise<void> {
  try {
    const sessionsResp = await client.session.list();
    const allSessions = sessionsResp?.data || [];

    // Find managed sessions
    const managedSessions = allSessions
      .filter((s: any) => s.title?.startsWith(MANAGED_SESSION_NAME))
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (let i = 0; i < managedSessions.length; i++) {
      const session = managedSessions[i];
      const createdAt = new Date(session.created_at);

      // If oldest and should rotate
      if (i === 0 && shouldRotateSession(createdAt, maxAgeDays)) {
        const newTitle = `${MANAGED_SESSION_NAME}.1`;
        await client.session.update({
          path: { id: session.id },
          body: { title: newTitle },
        });
      }
      // Handle existing rolled sessions
      else if (i >= maxRolling) {
        // Delete oldest beyond max rolling
        await client.session.delete({
          path: { id: session.id },
        });
      }
    }
  } catch (err) {
    logger.error('Session', 'Failed to rotate sessions:', err);
  }
}

/**
 * Delete old sessions beyond keepCount
 */
export async function deleteOldSessions(
  client: any,
  keepCount: number = 3
): Promise<void> {
  try {
    const sessionsResp = await client.session.list();
    const allSessions = sessionsResp?.data || [];

    // Find rolled sessions
    const rolledSessions = allSessions
      .filter((s: any) => s.title?.startsWith(`${MANAGED_SESSION_NAME}.`))
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Delete beyond keepCount
    const toDelete = rolledSessions.slice(keepCount);
    for (const session of toDelete) {
      await client.session.delete({
        path: { id: session.id },
      });
    }
  } catch (err) {
    logger.error('Session', 'Failed to delete old sessions:', err);
  }
}

/**
 * Cron Sys Session Manager
 * 
 * Manages "cron sys session" - creates new session for each CRON_SYS task execution,
 * rolling keeps 5 history sessions.
 */
export class CronSysSessionManager {
  private client: any;
  private baseName = 'cron sys session';
  private maxKeep = 5;

  constructor(client: any) {
    this.client = client;
  }

  async createSession(): Promise<string | null> {
    try {
      await this.housekeeping();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sessionTitle = `${this.baseName} ${timestamp}`;

      const newSession = await this.client.session.create({
        body: { title: sessionTitle },
      });

      const newSessionId = newSession.data?.id;
      if (newSessionId) {
        logger.info('CronSysSession', 'Created:', sessionTitle);
        return newSessionId;
      }

      return null;
    } catch (err) {
      logger.error('CronSysSession', 'Failed to create session:', err);
      return null;
    }
  }

  private async housekeeping(): Promise<void> {
    try {
      const sessionsResp = await this.client.session.list();
      const allSessions = sessionsResp?.data || [];

      const cronSessions = allSessions
        .filter((s: any) => s.title?.startsWith(this.baseName))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const toDelete = cronSessions.slice(this.maxKeep);
      
      logger.info('CronSysSession', `Housekeeping: ${cronSessions.length} sessions, deleting ${toDelete.length}`);

      for (const session of toDelete) {
        try {
          await this.client.session.delete({
            path: { id: session.id },
          });
          logger.info('CronSysSession', 'Deleted:', session.title);
        } catch (e) {
          logger.error('CronSysSession', 'Failed to delete:', session.title, e);
        }
      }
    } catch (err) {
      logger.error('CronSysSession', 'Housekeeping failed:', err);
    }
  }

  async getCurrentSession(): Promise<string | null> {
    try {
      const sessionsResp = await this.client.session.list();
      const allSessions = sessionsResp?.data || [];

      const currentSessions = allSessions
        .filter((s: any) => s.title?.startsWith(this.baseName) && !s.title?.match(/\.\d+$/));

      if (currentSessions.length > 0) {
        return currentSessions[0].id;
      }

      return null;
    } catch (err) {
      return null;
    }
  }
}
