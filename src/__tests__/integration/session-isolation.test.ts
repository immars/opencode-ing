/**
 * Integration Tests for Session Isolation
 *
 * Verifies that memory data is properly isolated between different chat sessions.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  readRecentMessages,
  readSoul,
  writeSoul,
} from '../../memory/levels.js';
import { getTodayString } from '../../memory/utils.js';
import {
  buildMemoryContext,
  getFeishuContext,
} from '../../memory/context.js';
import {
  readUsers,
  addToUsers,
} from '../../memory/users.js';
import {
  getUserProfile,
  updateUserProfile,
  getAllUserProfiles,
} from '../../memory/people.js';
import { MEMORY_ROOT_DIR } from '../../memory/constants.js';
import { getSessionDir, getSessionL0FilePath } from '../../memory/paths.js';

// Helper to create session L0 file with messages
function writeSessionMessages(
  projectDir: string,
  chatId: string,
  date: string,
  messages: Array<{ timestamp: string; role: 'user' | 'assistant'; content: string }>
): void {
  const sessionL0Dir = join(getSessionDir(projectDir, chatId), 'L0');
  if (!existsSync(sessionL0Dir)) {
    mkdirSync(sessionL0Dir, { recursive: true });
  }
  
  const filePath = getSessionL0FilePath(projectDir, chatId, date);
  const lines = [`# L0 Messages - ${date}`, ''];
  
  for (const msg of messages) {
    lines.push(`- [${msg.timestamp}] ${msg.role}: ${msg.content}`);
  }
  
  writeFileSync(filePath, lines.join('\n') + '\n');
}

describe('Session Isolation Integration Tests', () => {
  let testDir: string;
  const sessionA = 'chat-session-a';
  const sessionB = 'chat-session-b';
  const testDate = '2024-01-15';

  beforeEach(() => {
    // Create unique temp directory for each test
    testDir = join('/tmp', `.test-session-iso-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    
    // Create memory directory structure
    const memoryDir = join(testDir, MEMORY_ROOT_DIR);
    mkdirSync(memoryDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('L0 Message Isolation', () => {
    test('message written to session-A should NOT appear in session-B context', () => {
      // Write messages to session A only
      writeSessionMessages(testDir, sessionA, testDate, [
        { timestamp: '2024-01-15 10:00:00', role: 'user', content: 'Hello from session A' },
        { timestamp: '2024-01-15 10:00:05', role: 'assistant', content: 'Hi A!' },
      ]);

      // Read from session A - should get messages
      const messagesA = readRecentMessages(testDir, testDate, sessionA);
      expect(messagesA.length).toBe(2);
      expect(messagesA[0].content).toBe('Hello from session A');
      expect(messagesA[1].content).toBe('Hi A!');

      // Read from session B - should be empty
      const messagesB = readRecentMessages(testDir, testDate, sessionB);
      expect(messagesB.length).toBe(0);
    });

    test('different sessions should have independent message histories', () => {
      // Write different messages to each session
      writeSessionMessages(testDir, sessionA, testDate, [
        { timestamp: '2024-01-15 10:00:00', role: 'user', content: 'Session A message 1' },
      ]);
      
      writeSessionMessages(testDir, sessionB, testDate, [
        { timestamp: '2024-01-15 11:00:00', role: 'user', content: 'Session B message 1' },
        { timestamp: '2024-01-15 11:00:05', role: 'assistant', content: 'Session B response' },
      ]);

      // Verify session A only has its own messages
      const messagesA = readRecentMessages(testDir, testDate, sessionA);
      expect(messagesA.length).toBe(1);
      expect(messagesA[0].content).toBe('Session A message 1');

      // Verify session B only has its own messages
      const messagesB = readRecentMessages(testDir, testDate, sessionB);
      expect(messagesB.length).toBe(2);
      expect(messagesB[0].content).toBe('Session B message 1');
      expect(messagesB[1].content).toBe('Session B response');
    });

    test('adding messages to session-A should not affect session-B', () => {
      // Initial state: both sessions have messages
      writeSessionMessages(testDir, sessionA, testDate, [
        { timestamp: '2024-01-15 10:00:00', role: 'user', content: 'A initial' },
      ]);
      writeSessionMessages(testDir, sessionB, testDate, [
        { timestamp: '2024-01-15 10:00:00', role: 'user', content: 'B initial' },
      ]);

      // Verify initial state
      expect(readRecentMessages(testDir, testDate, sessionA).length).toBe(1);
      expect(readRecentMessages(testDir, testDate, sessionB).length).toBe(1);

      // Add more messages to session A
      writeSessionMessages(testDir, sessionA, testDate, [
        { timestamp: '2024-01-15 10:00:00', role: 'user', content: 'A initial' },
        { timestamp: '2024-01-15 10:05:00', role: 'user', content: 'A additional' },
      ]);

      // Session A should have 2 messages
      const messagesA = readRecentMessages(testDir, testDate, sessionA);
      expect(messagesA.length).toBe(2);

      // Session B should still have only 1 message
      const messagesB = readRecentMessages(testDir, testDate, sessionB);
      expect(messagesB.length).toBe(1);
      expect(messagesB[0].content).toBe('B initial');
    });
  });

  describe('USERS.md Isolation', () => {
    test('user added to session-A should NOT appear in session-B USERS.md', () => {
      // Add user to session A
      const result = addToUsers(testDir, sessionA, 'ou_user_alice');
      expect(result).toBe(true);

      // Session A should have the user
      const usersA = readUsers(testDir, sessionA);
      expect(usersA).toContain('ou_user_alice');

      // Session B should be empty
      const usersB = readUsers(testDir, sessionB);
      expect(usersB.length).toBe(0);
    });

    test('different sessions should track different @mentions', () => {
      // Add different users to different sessions
      addToUsers(testDir, sessionA, 'ou_user_alice');
      addToUsers(testDir, sessionA, 'ou_user_bob');
      addToUsers(testDir, sessionB, 'ou_user_charlie');

      // Verify session A has alice and bob
      const usersA = readUsers(testDir, sessionA);
      expect(usersA.length).toBe(2);
      expect(usersA).toContain('ou_user_alice');
      expect(usersA).toContain('ou_user_bob');

      // Verify session B has only charlie
      const usersB = readUsers(testDir, sessionB);
      expect(usersB.length).toBe(1);
      expect(usersB).toContain('ou_user_charlie');
      expect(usersB).not.toContain('ou_user_alice');
    });

    test('adding user to session-A after session-B has users should not affect session-B', () => {
      // Start: add user to session B
      addToUsers(testDir, sessionB, 'ou_user_first');
      expect(readUsers(testDir, sessionB).length).toBe(1);

      // Add user to session A
      addToUsers(testDir, sessionA, 'ou_user_second');
      
      // Session B should still have only its user
      const usersB = readUsers(testDir, sessionB);
      expect(usersB.length).toBe(1);
      expect(usersB).toContain('ou_user_first');
    });
  });

  describe('PEOPLE.md User Profile Isolation', () => {
    test('user profile in session-A should NOT be accessible from session-B', () => {
      // Create profile in session A
      const profile = updateUserProfile(testDir, sessionA, 'ou_user_alice', {
        name: 'Alice',
        preferences: 'Likes concise responses',
      });

      expect(profile.name).toBe('Alice');

      // Session A should have the profile
      const profileA = getUserProfile(testDir, sessionA, 'ou_user_alice');
      expect(profileA).not.toBeNull();
      expect(profileA?.name).toBe('Alice');

      // Session B should not have this profile
      const profileB = getUserProfile(testDir, sessionB, 'ou_user_alice');
      expect(profileB).toBeNull();
    });

    test('different sessions can have different profiles for same user', () => {
      // Create different profiles in each session
      updateUserProfile(testDir, sessionA, 'ou_user_alice', {
        name: 'Alice in Session A',
        preferences: 'Session A preferences',
      });

      updateUserProfile(testDir, sessionB, 'ou_user_alice', {
        name: 'Alice in Session B',
        preferences: 'Session B preferences',
        notes: 'Different notes for B',
      });

      // Verify isolation
      const profileA = getUserProfile(testDir, sessionA, 'ou_user_alice');
      expect(profileA?.name).toBe('Alice in Session A');
      expect(profileA?.preferences).toBe('Session A preferences');
      expect(profileA?.notes).toBeUndefined();

      const profileB = getUserProfile(testDir, sessionB, 'ou_user_alice');
      expect(profileB?.name).toBe('Alice in Session B');
      expect(profileB?.notes).toBe('Different notes for B');
    });

    test('getAllUserProfiles should return only session-specific profiles', () => {
      // Add profiles to different sessions
      updateUserProfile(testDir, sessionA, 'ou_user_alice', { name: 'Alice' });
      updateUserProfile(testDir, sessionA, 'ou_user_bob', { name: 'Bob' });
      updateUserProfile(testDir, sessionB, 'ou_user_charlie', { name: 'Charlie' });

      // Session A should have 2 profiles
      const profilesA = getAllUserProfiles(testDir, sessionA);
      expect(profilesA.size).toBe(2);
      expect(profilesA.has('ou_user_alice')).toBe(true);
      expect(profilesA.has('ou_user_bob')).toBe(true);
      expect(profilesA.has('ou_user_charlie')).toBe(false);

      // Session B should have 1 profile
      const profilesB = getAllUserProfiles(testDir, sessionB);
      expect(profilesB.size).toBe(1);
      expect(profilesB.has('ou_user_charlie')).toBe(true);
    });

    test('updating profile in session-A should not affect session-B profile for same user', () => {
      // Create initial profiles
      updateUserProfile(testDir, sessionA, 'ou_user_test', { name: 'Original A' });
      updateUserProfile(testDir, sessionB, 'ou_user_test', { name: 'Original B' });

      // Update profile in session A
      updateUserProfile(testDir, sessionA, 'ou_user_test', { name: 'Updated A' });

      // Session A should have updated name
      const profileA = getUserProfile(testDir, sessionA, 'ou_user_test');
      expect(profileA?.name).toBe('Updated A');

      // Session B should still have original name
      const profileB = getUserProfile(testDir, sessionB, 'ou_user_test');
      expect(profileB?.name).toBe('Original B');
    });
  });

  describe('buildMemoryContext Session Isolation', () => {
    test('buildMemoryContext with chatId should return only that session messages', () => {
      const today = getTodayString();
      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      
      writeSessionMessages(testDir, sessionA, today, [
        { timestamp, role: 'user', content: 'Session A context message' },
      ]);
      writeSessionMessages(testDir, sessionB, today, [
        { timestamp, role: 'user', content: 'Session B context message' },
      ]);

      const contextA = buildMemoryContext(testDir, 'feishu_message', sessionA);
      expect(contextA.recentMessages.length).toBe(1);
      expect(contextA.recentMessages[0].content).toBe('Session A context message');

      const contextB = buildMemoryContext(testDir, 'feishu_message', sessionB);
      expect(contextB.recentMessages.length).toBe(1);
      expect(contextB.recentMessages[0].content).toBe('Session B context message');
    });

    test('getFeishuContext should isolate messages per session', () => {
      const today = getTodayString();
      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      
      writeSessionMessages(testDir, sessionA, today, [
        { timestamp, role: 'user', content: 'A only' },
      ]);

      const contextA = getFeishuContext(testDir, sessionA);
      const contextB = getFeishuContext(testDir, sessionB);

      expect(contextA.recentMessages.length).toBe(1);
      expect(contextA.recentMessages[0].content).toBe('A only');
      expect(contextB.recentMessages.length).toBe(0);
    });
  });

  describe('Global SOUL.md Availability', () => {
    test('SOUL.md should be available to all sessions', () => {
      // Write global SOUL.md
      const soulContent = '# Agent Personality\n\nI am a helpful assistant.';
      writeSoul(testDir, soulContent);

      // Both sessions should be able to read the same SOUL
      const soulA = readSoul(testDir);
      const soulB = readSoul(testDir);

      expect(soulA).toBe(soulContent);
      expect(soulB).toBe(soulContent);
    });

    test('buildMemoryContext should include SOUL.md for any session', () => {
      // Write global SOUL.md
      const soulContent = '# Agent Personality\n\nI am a test assistant.';
      writeSoul(testDir, soulContent);

      // Both sessions should have SOUL in their context
      const contextA = buildMemoryContext(testDir, 'feishu_message', sessionA);
      const contextB = buildMemoryContext(testDir, 'feishu_message', sessionB);

      expect(contextA.longTermMemory.soul).toBe(soulContent);
      expect(contextB.longTermMemory.soul).toBe(soulContent);
    });

    test('SOUL.md updates should be visible to all sessions', () => {
      // Initial SOUL
      writeSoul(testDir, 'Initial personality');

      // Update SOUL
      const updatedSoul = 'Updated personality with new traits';
      writeSoul(testDir, updatedSoul);

      // Both sessions should see the update
      const contextA = buildMemoryContext(testDir, 'feishu_message', sessionA);
      const contextB = buildMemoryContext(testDir, 'feishu_message', sessionB);

      expect(contextA.longTermMemory.soul).toBe(updatedSoul);
      expect(contextB.longTermMemory.soul).toBe(updatedSoul);
    });
  });

  describe('Cross-session Data Leakage Prevention', () => {
    test('new session should start with empty data', () => {
      // Populate session A with data
      writeSessionMessages(testDir, sessionA, testDate, [
        { timestamp: '2024-01-15 10:00:00', role: 'user', content: 'A message' },
      ]);
      addToUsers(testDir, sessionA, 'ou_user_a');
      updateUserProfile(testDir, sessionA, 'ou_user_a', { name: 'User A' });

      // Create new session C
      const sessionC = 'new-session-c';

      // Session C should have no data from session A
      expect(readRecentMessages(testDir, testDate, sessionC).length).toBe(0);
      expect(readUsers(testDir, sessionC).length).toBe(0);
      expect(getUserProfile(testDir, sessionC, 'ou_user_a')).toBeNull();
    });

    test('deleting session directory should not affect other sessions', () => {
      // Create data in both sessions
      writeSessionMessages(testDir, sessionA, testDate, [
        { timestamp: '2024-01-15 10:00:00', role: 'user', content: 'A message' },
      ]);
      writeSessionMessages(testDir, sessionB, testDate, [
        { timestamp: '2024-01-15 11:00:00', role: 'user', content: 'B message' },
      ]);

      // Delete session A directory
      const sessionADir = getSessionDir(testDir, sessionA);
      rmSync(sessionADir, { recursive: true });

      // Session A should be empty now
      expect(readRecentMessages(testDir, testDate, sessionA).length).toBe(0);

      // Session B should still have its data
      const messagesB = readRecentMessages(testDir, testDate, sessionB);
      expect(messagesB.length).toBe(1);
      expect(messagesB[0].content).toBe('B message');
    });
  });
});
