/**
 * Session - Session Maintenance Module
 *
 * Manages OpenCode session lifecycle
 */

import { DEFAULTS } from './constants.js';

const MANAGED_SESSION_NAME = 'Assistant Managed Session';

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
      console.error(`[Session] Housekeeping "${prefix}": ${matched.length} found, deleting ${toDelete.length}`);
    }

    for (const session of toDelete) {
      try {
        await client.session.delete({
          path: { id: session.id },
        });
        console.error('[Session] Deleted:', session.title);
      } catch (e) {
        console.error('[Session] Failed to delete:', session.title, e);
      }
    }
  } catch (err) {
    console.error('[Session] Housekeeping failed:', err);
  }
}

/**
 * Get or create a managed session
 */
export async function getOrCreateManagedSession(client: any): Promise<string | null> {
  try {
    const sessionsResp = await client.session.list();
    const allSessions = sessionsResp?.data || [];

    // Find existing managed session
    const sessions = allSessions.filter((s: any) => s.title === MANAGED_SESSION_NAME);

    if (sessions.length > 0) {
      return sessions[0].id;
    }

    // Create new managed session
    const newSession = await client.session.create({
      body: { title: MANAGED_SESSION_NAME },
    });

    const newSessionId = newSession.data?.id;
    if (newSessionId) {
      return newSessionId;
    }

    return null;
  } catch (err) {
    console.error('Failed to get or create managed session:', err);
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
    console.error('Failed to rotate sessions:', err);
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
    console.error('Failed to delete old sessions:', err);
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
        console.error('[CronSysSession] Created:', sessionTitle);
        return newSessionId;
      }

      return null;
    } catch (err) {
      console.error('[CronSysSession] Failed to create session:', err);
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
      
      console.error(`[CronSysSession] Housekeeping: ${cronSessions.length} sessions, deleting ${toDelete.length}`);

      for (const session of toDelete) {
        try {
          await this.client.session.delete({
            path: { id: session.id },
          });
          console.error('[CronSysSession] Deleted:', session.title);
        } catch (e) {
          console.error('[CronSysSession] Failed to delete:', session.title, e);
        }
      }
    } catch (err) {
      console.error('[CronSysSession] Housekeeping failed:', err);
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
