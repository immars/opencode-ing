/**
 * Task File Integration Tests
 *
 * Tests task parsing and validation functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

describe('Task File Operations', () => {
  const testDir = '.code-ing/test-tasks';
  const testFilePath = path.join(testDir, 'task.json');

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('validateTaskFile', () => {
    it('should validate a correct task file', async () => {
      const { validateTaskFile } = await import('../../src/cli/task-file.js');

      const validTask = {
        taskId: 'task-123',
        description: 'Test task',
        requirements: ['req1', 'req2'],
        context: {
          files: ['file1.ts', 'file2.ts'],
          instructions: 'Some instructions',
        },
      };

      const result = validateTaskFile(validTask);

      expect(result).toBeDefined();
      expect(result?.taskId).toBe('task-123');
      expect(result?.description).toBe('Test task');
      expect(result?.requirements.length).toBe(2);
    });

    it('should return null for invalid task (missing taskId)', async () => {
      const { validateTaskFile } = await import('../../src/cli/task-file.js');

      const invalidTask = {
        description: 'Test task',
        requirements: [],
      };

      const result = validateTaskFile(invalidTask);

      expect(result).toBeNull();
    });

    it('should return null for invalid task (empty description)', async () => {
      const { validateTaskFile } = await import('../../src/cli/task-file.js');

      const invalidTask = {
        taskId: 'task-123',
        description: '',
        requirements: [],
      };

      const result = validateTaskFile(invalidTask);

      expect(result).toBeNull();
    });

    it('should apply default values for optional fields', async () => {
      const { validateTaskFile } = await import('../../src/cli/task-file.js');

      const minimalTask = {
        taskId: 'task-123',
        description: 'Test task',
      };

      const result = validateTaskFile(minimalTask);

      expect(result).toBeDefined();
      expect(result?.requirements).toEqual([]);
      expect(result?.context).toEqual({});
    });
  });

  describe('validateTaskResult', () => {
    it('should validate a correct task result', async () => {
      const { validateTaskResult } = await import('../../src/cli/task-file.js');

      const validResult = {
        taskId: 'task-123',
        status: 'success' as const,
        output: 'Task completed',
        completedAt: '2024-01-01T00:00:00Z',
      };

      const result = validateTaskResult(validResult);

      expect(result).toBeDefined();
      expect(result?.taskId).toBe('task-123');
      expect(result?.status).toBe('success');
    });

    it('should accept failure status', async () => {
      const { validateTaskResult } = await import('../../src/cli/task-file.js');

      const failedResult = {
        taskId: 'task-123',
        status: 'failure' as const,
        output: 'Task failed',
        completedAt: '2024-01-01T00:00:00Z',
      };

      const result = validateTaskResult(failedResult);

      expect(result).toBeDefined();
      expect(result?.status).toBe('failure');
    });

    it('should accept cancelled status', async () => {
      const { validateTaskResult } = await import('../../src/cli/task-file.js');

      const cancelledResult = {
        taskId: 'task-123',
        status: 'cancelled' as const,
        output: 'Task cancelled',
        completedAt: '2024-01-01T00:00:00Z',
      };

      const result = validateTaskResult(cancelledResult);

      expect(result).toBeDefined();
      expect(result?.status).toBe('cancelled');
    });

    it('should return null for invalid status', async () => {
      const { validateTaskResult } = await import('../../src/cli/task-file.js');

      const invalidResult = {
        taskId: 'task-123',
        status: 'invalid-status' as any,
        output: 'Task result',
        completedAt: '2024-01-01T00:00:00Z',
      };

      const result = validateTaskResult(invalidResult);

      expect(result).toBeNull();
    });

    it('should return null for missing required fields', async () => {
      const { validateTaskResult } = await import('../../src/cli/task-file.js');

      const incompleteResult = {
        taskId: 'task-123',
        status: 'success',
      };

      const result = validateTaskResult(incompleteResult);

      expect(result).toBeNull();
    });
  });

  describe('parseTaskFile', () => {
    it('should parse a valid task file from disk', async () => {
      const { parseTaskFile } = await import('../../src/cli/task-file.js');

      mkdirSync(testDir, { recursive: true });
      const taskData = {
        taskId: 'task-456',
        description: 'Parse test',
        requirements: ['req1'],
        context: {},
      };

      writeFileSync(testFilePath, JSON.stringify(taskData), 'utf-8');

      const result = parseTaskFile(testFilePath);

      expect(result).toBeDefined();
      expect(result?.taskId).toBe('task-456');
    });

    it('should return null for non-existent file', async () => {
      const { parseTaskFile } = await import('../../src/cli/task-file.js');

      const result = parseTaskFile('/non/existent/path.json');

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      const { parseTaskFile } = await import('../../src/cli/task-file.js');

      mkdirSync(testDir, { recursive: true });
      writeFileSync(testFilePath, 'not valid json', 'utf-8');

      const result = parseTaskFile(testFilePath);

      expect(result).toBeNull();
    });
  });

  describe('writeTaskFile', () => {
    it('should write a valid task file to disk', async () => {
      const { writeTaskFile, parseTaskFile } = await import('../../src/cli/task-file.js');

      mkdirSync(testDir, { recursive: true });
      const task = {
        taskId: 'task-789',
        description: 'Write test',
        requirements: ['req1', 'req2', 'req3'],
        context: {
          files: ['test.ts'],
        },
      };

      const result = writeTaskFile(testFilePath, task);

      expect(result).toBe(true);
      expect(existsSync(testFilePath)).toBe(true);

      const parsed = parseTaskFile(testFilePath);
      expect(parsed?.taskId).toBe('task-789');
      expect(parsed?.requirements.length).toBe(3);
    });

    it('should return false for invalid task', async () => {
      const { writeTaskFile } = await import('../../src/cli/task-file.js');

      mkdirSync(testDir, { recursive: true });
      const invalidTask = {
        taskId: '',
        description: '',
        requirements: [],
      } as any;

      const result = writeTaskFile(testFilePath, invalidTask);

      expect(result).toBe(false);
    });
  });

  describe('writeTaskResult', () => {
    it('should write a valid task result to disk', async () => {
      const { writeTaskResult, validateTaskResult } = await import('../../src/cli/task-file.js');

      mkdirSync(testDir, { recursive: true });
      const resultData = {
        taskId: 'task-result-1',
        status: 'success' as const,
        output: 'Completed successfully',
        completedAt: new Date().toISOString(),
      };

      const result = writeTaskResult(testFilePath, resultData);

      expect(result).toBe(true);
      expect(existsSync(testFilePath)).toBe(true);

      const content = readFileSync(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.taskId).toBe('task-result-1');
      expect(parsed.status).toBe('success');
    });

    it('should return false for invalid task result', async () => {
      const { writeTaskResult } = await import('../../src/cli/task-file.js');

      mkdirSync(testDir, { recursive: true });
      const invalidResult = {
        taskId: '',
        status: 'invalid' as any,
        output: '',
        completedAt: '',
      };

      const result = writeTaskResult(testFilePath, invalidResult);

      expect(result).toBe(false);
    });
  });
});
