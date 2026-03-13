/**
 * Session - Session Maintenance Module
 *
 * Manages OpenCode session lifecycle
 */

import { DEFAULTS } from '../memory/constants.js';

const MANAGED_SESSION_NAME = 'Assistant Managed Session';

export async function getOrCreateManagedSession(client: any): Promise<string | null> {
  try {
    const sessionsResp = await client.session.list();
    const allSessions = sessionsResp?.data || [];

    const sessions = allSessions.filter((s: any) => s.title === MANAGED_SESSION_NAME);

    if (sessions.length > 0) {
      return sessions[0].id;
    }

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

export function shouldRotateSession(
  createdAt: Date,
  maxAgeDays: number = DEFAULTS.SESSION_MAX_AGE_DAYS
): boolean {
  const now = new Date();
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays > maxAgeDays;
}

export async function rotateOldSessions(
  client: any,
  maxAgeDays: number = DEFAULTS.SESSION_MAX_AGE_DAYS,
  maxRolling: number = DEFAULTS.SESSION_MAX_ROLLING
): Promise<void> {
  try {
    const sessionsResp = await client.session.list();
    const allSessions = sessionsResp?.data || [];

    const managedSessions = allSessions
      .filter((s: any) => s.title?.startsWith(MANAGED_SESSION_NAME))
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (let i = 0; i < managedSessions.length; i++) {
      const session = managedSessions[i];
      const createdAt = new Date(session.created_at);

      if (i === 0 && shouldRotateSession(createdAt, maxAgeDays)) {
        const newTitle = `${MANAGED_SESSION_NAME}.1`;
        await client.session.update({
          path: { id: session.id },
          body: { title: newTitle },
        });
      }
      else if (i >= maxRolling) {
        await client.session.delete({
          path: { id: session.id },
        });
      }
    }
  } catch (err) {
    console.error('Failed to rotate sessions:', err);
  }
}

export async function deleteOldSessions(
  client: any,
  keepCount: number = 3
): Promise<void> {
  try {
    const sessionsResp = await client.session.list();
    const allSessions = sessionsResp?.data || [];

    const rolledSessions = allSessions
      .filter((s: any) => s.title?.startsWith(`${MANAGED_SESSION_NAME}.`))
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
