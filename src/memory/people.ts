/**
 * People - User Profile Management Module
 *
 * Parses and manages PEOPLE.md files for multi-user profiles
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getSessionDir } from './paths.js';
import { L9_FILES } from './constants.js';

/**
 * User profile stored in PEOPLE.md
 */
export interface UserProfile {
  open_id: string;
  name?: string;
  preferences?: string;
  last_interaction?: string;
  notes?: string;
}

/**
 * Parse PEOPLE.md content into UserProfile map
 */
export function parsePeopleFile(content: string): Map<string, UserProfile> {
  const users = new Map<string, UserProfile>();

  if (!content.trim()) {
    return users;
  }

  const sections = content.split(/^## /m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split('\n');
    const openId = lines[0].trim();

    if (!openId) continue;

    const profile: UserProfile = { open_id: openId };

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();

      if (trimmed.startsWith('Name:')) {
        profile.name = trimmed.substring(5).trim();
      } else if (trimmed.startsWith('Preferences:')) {
        profile.preferences = trimmed.substring(12).trim();
      } else if (trimmed.startsWith('Last Interaction:')) {
        profile.last_interaction = trimmed.substring(16).trim();
      } else if (trimmed.startsWith('Notes:')) {
        profile.notes = trimmed.substring(6).trim();
      }
    }

    users.set(openId, profile);
  }

  return users;
}

/**
 * Serialize UserProfile map back to PEOPLE.md format
 */
export function serializePeopleFile(users: Map<string, UserProfile>): string {
  const sections: string[] = [];

  for (const [openId, profile] of users) {
    const lines: string[] = [`## ${openId}`];

    if (profile.name) {
      lines.push(`Name: ${profile.name}`);
    }
    if (profile.preferences) {
      lines.push(`Preferences: ${profile.preferences}`);
    }
    if (profile.last_interaction) {
      lines.push(`Last Interaction: ${profile.last_interaction}`);
    }
    if (profile.notes) {
      lines.push(`Notes: ${profile.notes}`);
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * Get path to session PEOPLE.md file
 */
function getPeopleFilePath(projectDir: string, chatId: string): string {
  return join(getSessionDir(projectDir, chatId), L9_FILES.PEOPLE);
}

/**
 * Ensure session directory exists
 */
function ensureSessionDir(projectDir: string, chatId: string): void {
  const dir = getSessionDir(projectDir, chatId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get user profile from PEOPLE.md
 * @param projectDir - The project directory path
 * @param chatId - The chat/session ID
 * @param openId - The user's open_id
 * @returns UserProfile or null if not found
 */
export function getUserProfile(
  projectDir: string,
  chatId: string,
  openId: string
): UserProfile | null {
  const filePath = getPeopleFilePath(projectDir, chatId);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const users = parsePeopleFile(content);

  return users.get(openId) || null;
}

/**
 * Update or create user profile in PEOPLE.md
 * @param projectDir - The project directory path
 * @param chatId - The chat/session ID
 * @param openId - The user's open_id
 * @param updates - Partial profile updates to apply
 * @returns Updated UserProfile
 */
export function updateUserProfile(
  projectDir: string,
  chatId: string,
  openId: string,
  updates: Partial<Omit<UserProfile, 'open_id'>>
): UserProfile {
  const filePath = getPeopleFilePath(projectDir, chatId);

  // Ensure directory exists
  ensureSessionDir(projectDir, chatId);

  // Parse existing content
  let content = '';
  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf-8');
  }
  const users = parsePeopleFile(content);

  // Get existing profile or create new one
  const existing = users.get(openId) || { open_id: openId };

  // Merge updates
  const updated: UserProfile = {
    ...existing,
    ...updates,
    open_id: openId, // Ensure open_id is never overwritten
  };

  users.set(openId, updated);

  // Write back
  writeFileSync(filePath, serializePeopleFile(users));

  return updated;
}

/**
 * Get all user profiles from PEOPLE.md
 * @param projectDir - The project directory path
 * @param chatId - The chat/session ID
 * @returns Map of open_id to UserProfile
 */
export function getAllUserProfiles(
  projectDir: string,
  chatId: string
): Map<string, UserProfile> {
  const filePath = getPeopleFilePath(projectDir, chatId);

  if (!existsSync(filePath)) {
    return new Map();
  }

  const content = readFileSync(filePath, 'utf-8');
  return parsePeopleFile(content);
}
