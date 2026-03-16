/**
 * Memory System - USERS.md Module
 *
 * Handles @mention tracking for sessions.
 * Stores open_ids of users who have been @mentioned in a session.
 */

import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { getSessionDir } from './paths.js';

const USERS_FILENAME = 'USERS.md';

/**
 * Get path to USERS.md file for a session
 * @param projectDir - The project directory path
 * @param chatId - The chat/session ID
 * @returns Path to memory/sessions/{chatId}/USERS.md
 */
function getUsersPath(projectDir: string, chatId: string): string {
  return join(getSessionDir(projectDir, chatId), USERS_FILENAME);
}

/**
 * Read list of open_ids from USERS.md
 * @param projectDir - The project directory path
 * @param chatId - The chat/session ID
 * @returns Array of open_id strings (empty if file doesn't exist)
 */
export function readUsers(projectDir: string, chatId: string): string[] {
  const usersPath = getUsersPath(projectDir, chatId);
  
  if (!existsSync(usersPath)) {
    return [];
  }
  
  try {
    const content = readFileSync(usersPath, 'utf-8');
    // Split by newlines, filter empty lines, trim each line
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch {
    return [];
  }
}

/**
 * Add an open_id to USERS.md if not already present
 * @param projectDir - The project directory path
 * @param chatId - The chat/session ID
 * @param openId - The open_id to add
 * @returns true if added (or already existed), false on error
 */
export function addToUsers(projectDir: string, chatId: string, openId: string): boolean {
  if (!openId || openId.trim().length === 0) {
    return false;
  }
  
  const trimmedOpenId = openId.trim();
  
  // Check if already exists
  const existingUsers = readUsers(projectDir, chatId);
  if (existingUsers.includes(trimmedOpenId)) {
    return true; // Already exists, no need to add
  }
  
  const usersPath = getUsersPath(projectDir, chatId);
  
  try {
    // Ensure session directory exists
    const sessionDir = getSessionDir(projectDir, chatId);
    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true });
    }
    
    // Append the open_id with newline
    // If file doesn't exist yet, just write the id; otherwise prepend with newline
    const fileExists = existsSync(usersPath);
    const content = fileExists ? `\n${trimmedOpenId}` : trimmedOpenId;
    appendFileSync(usersPath, content, 'utf-8');
    
    return true;
  } catch {
    return false;
  }
}
