/**
 * Memory System - Path Utilities
 *
 * Path functions for global and session-scoped memory files
 */

import { join } from 'path';
import { readdirSync, existsSync } from 'fs';
import { MEMORY_ROOT_DIR, L0_DIR, L1_DIR, L2_DIR } from './constants.js';
import { getWorkspaceDir } from './utils.js';

/**
 * Get the sessions root directory: memory/sessions/
 * @param projectDir - The project directory path
 * @returns Path to memory/sessions/
 */
export function getSessionsDir(projectDir: string): string {
  return join(projectDir, MEMORY_ROOT_DIR, 'sessions');
}

/**
 * List all session IDs (chat IDs) that have memory directories
 * @param projectDir - The project directory path
 * @returns Array of session IDs
 */
export function listAllSessions(projectDir: string): string[] {
  const sessionsDir = getSessionsDir(projectDir);
  if (!existsSync(sessionsDir)) {
    return [];
  }
  return readdirSync(sessionsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

/**
 * Get path to global SOUL.md file
 * @param projectDir - The project directory path
 * @returns Path to memory/global/SOUL.md
 */
export function getGlobalSoulPath(projectDir: string): string {
  return join(projectDir, MEMORY_ROOT_DIR, 'global', 'SOUL.md');
}

/**
 * Get path to a session L9 file
 * @param projectDir - The project directory path
 * @param chatId - The chat/session ID
 * @param filename - The L9 filename (e.g., PEOPLE.md, TASK.md, CRON.md, CRON_SYS.md)
 * @returns Path to memory/sessions/{chatId}/{filename}
 */
export function getSessionL9FilePath(
  projectDir: string,
  chatId: string,
  filename: string
): string {
  return join(projectDir, MEMORY_ROOT_DIR, 'sessions', chatId, filename);
}

/**
 * Get path to session directory
 * @param projectDir - The project directory path
 * @param chatId - The chat/session ID
 * @returns Path to memory/sessions/{chatId}/
 */
export function getSessionDir(projectDir: string, chatId: string): string {
  return join(projectDir, MEMORY_ROOT_DIR, 'sessions', chatId);
}

/**
 * Get path to global memory directory
 * @param projectDir - The project directory path
 * @returns Path to memory/global/
 */
export function getGlobalDir(projectDir: string): string {
  return join(projectDir, MEMORY_ROOT_DIR, 'global');
}

export function getSessionL0FilePath(projectDir: string, chatId: string, date: string): string {
  return join(getSessionDir(projectDir, chatId), L0_DIR, `${date}.md`);
}

export function getSessionL0Dir(projectDir: string, chatId: string): string {
  return join(getSessionDir(projectDir, chatId), L0_DIR);
}

export function getSessionL1FilePath(projectDir: string, chatId: string, date: string): string {
  return join(getSessionDir(projectDir, chatId), L1_DIR, `${date}.md`);
}

export function getSessionL1Dir(projectDir: string, chatId: string): string {
  return join(getSessionDir(projectDir, chatId), L1_DIR);
}

export function getSessionL2FilePath(projectDir: string, chatId: string, weekStart: string): string {
  return join(getSessionDir(projectDir, chatId), L2_DIR, `${weekStart}.md`);
}

export function getSessionL2Dir(projectDir: string, chatId: string): string {
  return join(getSessionDir(projectDir, chatId), L2_DIR);
}
