/**
 * Tests for memory/context.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  getL0Content,
  getL1Content,
  buildMemoryContext,
  getFeishuContext,
  getScheduledContext,
  buildVariableContext,
  substituteVariables,
  hasVariables,
  buildCompressionPrompt,
} from '../memory/context.js';
import { MEMORY_ROOT_DIR } from '../memory/constants.js';

const TEST_DIR = join('/tmp', '.test-context-' + Date.now());
const MEMORY_DIR = join(TEST_DIR, MEMORY_ROOT_DIR);
const SESSION_DIR = join(MEMORY_DIR, 'sessions', 'test-chat-id');
const SESSION_L0_DIR = join(SESSION_DIR, 'L0');
const SESSION_L1_DIR = join(SESSION_DIR, 'L1');
const GLOBAL_L1_DIR = join(MEMORY_DIR, 'L1');

describe('Memory Context Module', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(SESSION_L0_DIR, { recursive: true });
    mkdirSync(SESSION_L1_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('getL0Content', () => {
    it('should return empty string when no L0 file exists', () => {
      const content = getL0Content(TEST_DIR, 'test-chat-id');
      expect(content).toBe('');
    });

    it('should return formatted L0 content when file exists', () => {
      const today = new Date().toISOString().slice(0, 10);
      const l0File = join(SESSION_L0_DIR, `${today}.md`);
      writeFileSync(l0File, `# L0 Messages - ${today}\n\n- [2024-01-01 10:00:00] user: Hello\n- [2024-01-01 10:00:05] assistant: Hi there!`);

      const content = getL0Content(TEST_DIR, 'test-chat-id');
      expect(content).toContain('## ' + today);
      expect(content).toContain('user: Hello');
      expect(content).toContain('assistant: Hi there!');
    });
  });

  describe('getL1Content', () => {
    it('should return empty string when no L1 files exist', () => {
      const content = getL1Content(TEST_DIR, 'test-chat-id');
      expect(content).toBe('');
    });

    it('should return L1 content when files exist', () => {
      const today = new Date().toISOString().slice(0, 10);
      const l1File = join(SESSION_L1_DIR, `${today}.md`);
      writeFileSync(l1File, 'Daily summary content');

      const content = getL1Content(TEST_DIR, 'test-chat-id');
      expect(content).toContain(today);
      expect(content).toContain('Daily summary content');
    });
  });

  describe('buildMemoryContext', () => {
    it('should build memory context with chatId', () => {
      const context = buildMemoryContext(TEST_DIR, 'feishu_message', 'test-chat-id');
      
      expect(context.triggerType).toBe('feishu_message');
      expect(context.recentMessages).toEqual([]);
      expect(context.dailySummaries).toEqual([]);
      expect(context.weeklySummaries).toEqual([]);
      expect(context.longTermMemory).toBeDefined();
    });

    it('should return scheduled context with scheduled trigger type', () => {
      const context = buildMemoryContext(TEST_DIR, 'scheduled', 'test-chat-id');
      expect(context.triggerType).toBe('scheduled');
    });
  });

  describe('getFeishuContext', () => {
    it('should return context with feishu_message trigger type', () => {
      const context = getFeishuContext(TEST_DIR, 'test-chat-id');
      expect(context.triggerType).toBe('feishu_message');
    });
  });

  describe('getScheduledContext', () => {
    it('should return context with scheduled trigger type', () => {
      const context = getScheduledContext(TEST_DIR, 'test-chat-id');
      expect(context.triggerType).toBe('scheduled');
    });
  });

  describe('buildVariableContext', () => {
    it('should build variable context with chatId', () => {
      const vars = buildVariableContext(TEST_DIR, 'test-chat-id');
      
      expect(vars).toHaveProperty('L0');
      expect(vars).toHaveProperty('L1');
      expect(vars).toHaveProperty('L1_path');
      expect(vars).toHaveProperty('L2_path');
    });
  });

  describe('substituteVariables', () => {
    it('should substitute L0 variable', () => {
      const vars = { L0: 'L0 content', L1: '', L1_path: '/path/L1.md', L2_path: '/path/L2.md' };
      const result = substituteVariables('Prefix {L0} suffix', vars);
      expect(result).toBe('Prefix L0 content suffix');
    });

    it('should substitute L0_content variable', () => {
      const vars = { L0: 'L0 content', L1: '', L1_path: '/path/L1.md', L2_path: '/path/L2.md' };
      const result = substituteVariables('Prefix {L0_content} suffix', vars);
      expect(result).toBe('Prefix L0 content suffix');
    });

    it('should substitute L1 variable', () => {
      const vars = { L0: '', L1: 'L1 content', L1_path: '/path/L1.md', L2_path: '/path/L2.md' };
      const result = substituteVariables('Prefix {L1} suffix', vars);
      expect(result).toBe('Prefix L1 content suffix');
    });

    it('should substitute path variables', () => {
      const vars = { L0: '', L1: '', L1_path: '/path/L1.md', L2_path: '/path/L2.md' };
      const result = substituteVariables('{L1_path} and {L2_path}', vars);
      expect(result).toBe('/path/L1.md and /path/L2.md');
    });
  });

  describe('hasVariables', () => {
    it('should detect L0 variable', () => {
      expect(hasVariables('Some {L0} content')).toBe(true);
    });

    it('should detect L0_content variable', () => {
      expect(hasVariables('Some {L0_content} content')).toBe(true);
    });

    it('should detect L1 variable', () => {
      expect(hasVariables('Some {L1} content')).toBe(true);
    });

    it('should detect L1_path variable', () => {
      expect(hasVariables('Some {L1_path} content')).toBe(true);
    });

    it('should detect L2_path variable', () => {
      expect(hasVariables('Some {L2_path} content')).toBe(true);
    });

    it('should return false for no variables', () => {
      expect(hasVariables('No variables here')).toBe(false);
    });
  });

  describe('buildCompressionPrompt', () => {
    it('should build L1 compression prompt with chatId', () => {
      const prompt = buildCompressionPrompt(TEST_DIR, 'L1', 'test-chat-id');
      expect(prompt).toContain('<detail>');
      expect(prompt).toContain('</detail>');
      expect(prompt).toContain('压缩处理');
    });

    it('should build L2 compression prompt with chatId', () => {
      const prompt = buildCompressionPrompt(TEST_DIR, 'L2', 'test-chat-id');
      expect(prompt).toContain('<detail>');
      expect(prompt).toContain('</detail>');
      expect(prompt).toContain('压缩处理');
    });
  });
});
