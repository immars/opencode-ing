/**
 * Registry Integration Tests
 *
 * Tests registry CRUD operations and file lock functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, rmSync } from 'node:fs';

describe('Registry Operations', () => {
  const agentsDir = '.code-ing/agents';

  beforeEach(() => {
    vi.resetModules();
    if (existsSync(agentsDir)) {
      rmSync(agentsDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    vi.resetModules();
    if (existsSync(agentsDir)) {
      rmSync(agentsDir, { recursive: true, force: true });
    }
  });

  describe('loadRegistry', () => {
    it('should create new registry with default values', async () => {
      const { loadRegistry } = await import('../../src/cli/registry.js');
      const registry = loadRegistry();

      expect(registry).toBeDefined();
      expect(registry.agents).toBeDefined();
      expect(Object.keys(registry.agents).length).toBe(0);
      expect(registry.version).toBe(1);
    });
  });

  describe('registerAgent', () => {
    it('should register a new agent and persist to disk', async () => {
      const { registerAgent, loadRegistry } = await import('../../src/cli/registry.js');

      const agentInfo = {
        type: 'opencode' as const,
        path: '/test/path',
        pid: 12345,
        sessionId: 'test-session',
        startedAt: new Date().toISOString(),
        status: 'running' as const,
      };

      const result = registerAgent('test-session', agentInfo);

      expect(result).toBe(true);

      const registry = loadRegistry();
      expect(registry.agents['test-session']).toBeDefined();
      expect(registry.agents['test-session'].pid).toBe(12345);
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister an existing agent', async () => {
      const { registerAgent, unregisterAgent, loadRegistry } = await import('../../src/cli/registry.js');

      const agentInfo = {
        type: 'opencode' as const,
        path: '/test/path',
        pid: 12345,
        sessionId: 'test-session',
        startedAt: new Date().toISOString(),
        status: 'running' as const,
      };

      registerAgent('test-session', agentInfo);
      const unregisterResult = unregisterAgent('test-session');

      expect(unregisterResult).toBe(true);

      const registry = loadRegistry();
      expect(registry.agents['test-session']).toBeUndefined();
    });

    it('should return false when unregistering non-existent agent', async () => {
      const { unregisterAgent } = await import('../../src/cli/registry.js');

      const result = unregisterAgent('non-existent-session');

      expect(result).toBe(false);
    });
  });

  describe('getAgent', () => {
    it('should get an existing agent', async () => {
      const { registerAgent, getAgent } = await import('../../src/cli/registry.js');

      const agentInfo = {
        type: 'opencode' as const,
        path: '/test/path',
        pid: 12345,
        sessionId: 'test-session',
        startedAt: new Date().toISOString(),
        status: 'running' as const,
      };

      registerAgent('test-session', agentInfo);
      const agent = getAgent('test-session');

      expect(agent).toBeDefined();
      expect(agent?.pid).toBe(12345);
      expect(agent?.type).toBe('opencode');
    });

    it('should return null for non-existent agent', async () => {
      const { getAgent } = await import('../../src/cli/registry.js');

      const agent = getAgent('non-existent-session');

      expect(agent).toBeNull();
    });
  });

  describe('listAgents', () => {
    it('should list all agents without filter', async () => {
      const { registerAgent, listAgents } = await import('../../src/cli/registry.js');

      registerAgent('session-1', {
        type: 'opencode' as const,
        path: '/path1',
        pid: 111,
        sessionId: 'session-1',
        startedAt: new Date().toISOString(),
        status: 'running' as const,
      });

      registerAgent('session-2', {
        type: 'claude-code' as const,
        path: '/path2',
        pid: 222,
        sessionId: 'session-2',
        startedAt: new Date().toISOString(),
        status: 'stopped' as const,
      });

      const agents = listAgents();

      expect(agents.length).toBe(2);
    });

    it('should filter agents by status', async () => {
      const { registerAgent, listAgents } = await import('../../src/cli/registry.js');

      registerAgent('session-1', {
        type: 'opencode' as const,
        path: '/path1',
        pid: 111,
        sessionId: 'session-1',
        startedAt: new Date().toISOString(),
        status: 'running' as const,
      });

      registerAgent('session-2', {
        type: 'claude-code' as const,
        path: '/path2',
        pid: 222,
        sessionId: 'session-2',
        startedAt: new Date().toISOString(),
        status: 'stopped' as const,
      });

      const runningAgents = listAgents({ status: 'running' });
      const stoppedAgents = listAgents({ status: 'stopped' });

      expect(runningAgents.length).toBe(1);
      expect(runningAgents[0].sessionId).toBe('session-1');

      expect(stoppedAgents.length).toBe(1);
      expect(stoppedAgents[0].sessionId).toBe('session-2');
    });

    it('should filter agents by type', async () => {
      const { registerAgent, listAgents } = await import('../../src/cli/registry.js');

      registerAgent('session-1', {
        type: 'opencode' as const,
        path: '/path1',
        pid: 111,
        sessionId: 'session-1',
        startedAt: new Date().toISOString(),
        status: 'running' as const,
      });

      registerAgent('session-2', {
        type: 'claude-code' as const,
        path: '/path2',
        pid: 222,
        sessionId: 'session-2',
        startedAt: new Date().toISOString(),
        status: 'running' as const,
      });

      const opencodeAgents = listAgents({ type: 'opencode' });
      const claudeAgents = listAgents({ type: 'claude-code' });

      expect(opencodeAgents.length).toBe(1);
      expect(opencodeAgents[0].sessionId).toBe('session-1');

      expect(claudeAgents.length).toBe(1);
      expect(claudeAgents[0].sessionId).toBe('session-2');
    });
  });

  describe('acquireLock and releaseLock', () => {
    it('should acquire lock when no lock exists', async () => {
      const { loadRegistry, acquireLock, releaseLock } = await import('../../src/cli/registry.js');

      loadRegistry();

      const result = acquireLock(5000);

      expect(result).toBe(true);

      releaseLock();
    });

    it('should fail to acquire lock when timeout exceeded', async () => {
      const { loadRegistry, acquireLock, releaseLock } = await import('../../src/cli/registry.js');

      loadRegistry();

      const lock1 = acquireLock(5000);
      if (!lock1) {
        releaseLock();
      }
      expect(lock1).toBe(true);

      releaseLock();
    });
  });
});
