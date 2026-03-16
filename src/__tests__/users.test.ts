/**
 * Tests for memory/users.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { readUsers, addToUsers } from '../memory/users.js';
import { MEMORY_ROOT_DIR } from '../memory/constants.js';

const TEST_DIR = join('/tmp', '.test-users-' + Date.now());
const MEMORY_DIR = join(TEST_DIR, MEMORY_ROOT_DIR);
const SESSION_DIR = join(MEMORY_DIR, 'sessions', 'test-chat-id');

describe('Memory Users Module', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(SESSION_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('readUsers', () => {
    it('should return empty array when USERS.md does not exist', () => {
      const users = readUsers(TEST_DIR, 'test-chat-id');
      expect(users).toEqual([]);
    });

    it('should return array of open_ids when USERS.md exists', () => {
      const usersPath = join(SESSION_DIR, 'USERS.md');
      const { writeFileSync } = require('fs');
      writeFileSync(usersPath, 'ou_user_1\nou_user_2\nou_user_3');
      
      const users = readUsers(TEST_DIR, 'test-chat-id');
      expect(users).toEqual(['ou_user_1', 'ou_user_2', 'ou_user_3']);
    });

    it('should handle empty lines in USERS.md', () => {
      const usersPath = join(SESSION_DIR, 'USERS.md');
      const { writeFileSync } = require('fs');
      writeFileSync(usersPath, 'ou_user_1\n\nou_user_2\n  \nou_user_3');
      
      const users = readUsers(TEST_DIR, 'test-chat-id');
      expect(users).toEqual(['ou_user_1', 'ou_user_2', 'ou_user_3']);
    });
  });

  describe('addToUsers', () => {
    it('should create USERS.md with first user', () => {
      const result = addToUsers(TEST_DIR, 'test-chat-id', 'ou_user_1');
      expect(result).toBe(true);
      
      const usersPath = join(SESSION_DIR, 'USERS.md');
      expect(existsSync(usersPath)).toBe(true);
      
      const content = readFileSync(usersPath, 'utf-8');
      expect(content).toBe('ou_user_1');
    });

    it('should append new user to existing USERS.md', () => {
      addToUsers(TEST_DIR, 'test-chat-id', 'ou_user_1');
      addToUsers(TEST_DIR, 'test-chat-id', 'ou_user_2');
      
      const users = readUsers(TEST_DIR, 'test-chat-id');
      expect(users).toEqual(['ou_user_1', 'ou_user_2']);
    });

    it('should not duplicate existing user', () => {
      addToUsers(TEST_DIR, 'test-chat-id', 'ou_user_1');
      addToUsers(TEST_DIR, 'test-chat-id', 'ou_user_1');
      addToUsers(TEST_DIR, 'test-chat-id', 'ou_user_1');
      
      const users = readUsers(TEST_DIR, 'test-chat-id');
      expect(users).toEqual(['ou_user_1']);
    });

    it('should return true if user already exists', () => {
      addToUsers(TEST_DIR, 'test-chat-id', 'ou_user_1');
      const result = addToUsers(TEST_DIR, 'test-chat-id', 'ou_user_1');
      expect(result).toBe(true);
    });

    it('should return false for empty openId', () => {
      const result = addToUsers(TEST_DIR, 'test-chat-id', '');
      expect(result).toBe(false);
    });

    it('should return false for whitespace-only openId', () => {
      const result = addToUsers(TEST_DIR, 'test-chat-id', '   ');
      expect(result).toBe(false);
    });

    it('should trim whitespace from openId', () => {
      addToUsers(TEST_DIR, 'test-chat-id', '  ou_user_1  ');
      
      const users = readUsers(TEST_DIR, 'test-chat-id');
      expect(users).toEqual(['ou_user_1']);
    });

    it('should create session directory if it does not exist', () => {
      const newChatId = 'new-chat-id';
      const result = addToUsers(TEST_DIR, newChatId, 'ou_user_new');
      
      expect(result).toBe(true);
      
      const users = readUsers(TEST_DIR, newChatId);
      expect(users).toEqual(['ou_user_new']);
    });
  });
});
