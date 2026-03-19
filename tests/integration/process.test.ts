/**
 * Process Integration Tests
 *
 * Tests child process spawning and management functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';

describe('Process Operations', () => {
  describe('spawnAgent', () => {
    it('should spawn a simple echo process', async () => {
      const { spawnAgent } = await import('../../src/cli/process.js');

      const proc = spawnAgent('echo', ['hello'], process.cwd());

      expect(proc).toBeDefined();
      expect(proc.pid).toBeGreaterThan(0);

      await new Promise<void>((resolve) => {
        proc.on('close', (code) => {
          expect(code).toBe(0);
          resolve();
        });
      });
    });

    it('should spawn process with correct working directory', async () => {
      const { spawnAgent } = await import('../../src/cli/process.js');

      const proc = spawnAgent('pwd', [], process.cwd());

      expect(proc).toBeDefined();
      expect(proc.pid).toBeGreaterThan(0);

      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise<void>((resolve) => {
        proc.on('close', () => {
          expect(output.trim()).toBe(process.cwd());
          resolve();
        });
      });
    });

    it('should capture stderr output', async () => {
      const { spawnAgent } = await import('../../src/cli/process.js');

      const proc = spawnAgent('node', ['-e', 'console.error("test error")'], process.cwd());

      let errorOutput = '';
      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      await new Promise<void>((resolve) => {
        proc.on('close', () => {
          expect(errorOutput.trim()).toBe('test error');
          resolve();
        });
      });
    });
  });

  describe('isProcessRunning', () => {
    it('should return true for running process', async () => {
      const { spawnAgent, isProcessRunning } = await import('../../src/cli/process.js');

      const proc = spawnAgent('sleep', ['10'], process.cwd());
      const pid = proc.pid!;

      expect(isProcessRunning(pid)).toBe(true);

      proc.kill();
    });

    it('should return false for non-existent pid', async () => {
      const { isProcessRunning } = await import('../../src/cli/process.js');

      expect(isProcessRunning(999999)).toBe(false);
    });
  });

  describe('killProcess', () => {
    it('should return false for non-existent process', async () => {
      const { killProcess } = await import('../../src/cli/process.js');

      const result = killProcess(999999);

      expect(result).toBe(false);
    });
  });

  describe('getProcessInfo', () => {
    it('should return info for running process', async () => {
      const { spawnAgent, getProcessInfo, killProcess } = await import('../../src/cli/process.js');

      const proc = spawnAgent('node', ['-e', 'setTimeout(() => {}, 10000)'], process.cwd());
      const pid = proc.pid!;

      await new Promise<void>((resolve) => {
        proc.on('spawn', () => {
          const info = getProcessInfo(pid);
          expect(info).toBeDefined();
          expect(info?.pid).toBe(pid);
          expect(info?.isRunning).toBe(true);
          resolve();
        });
      });

      killProcess(pid);
    });

    it('should return null for non-existent process', async () => {
      const { getProcessInfo } = await import('../../src/cli/process.js');

      const info = getProcessInfo(999999);

      expect(info).toBeNull();
    });
  });

  describe('gracefulKillProcess', () => {
    it('should return false for non-existent process', async () => {
      const { gracefulKillProcess } = await import('../../src/cli/process.js');

      const result = await gracefulKillProcess(999999);

      expect(result).toBe(false);
    });
  });
});
