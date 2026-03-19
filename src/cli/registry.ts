/**
 * Agent Registry Module
 *
 * Manages persistent registry of active agents with file-based storage.
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';

export interface AgentInfo {
  type: 'opencode' | 'claude-code';
  path: string;
  pid: number;
  sessionId: string;
  startedAt: string;
  status: 'running' | 'stopped' | 'error';
}

interface Registry {
  agents: Record<string, AgentInfo>;
  version: number;
}

const REGISTRY_DIR = '.code-ing/agents';
const REGISTRY_FILE = 'registry.json';
const LOCK_FILE = 'registry.lock';
const REGISTRY_PATH = path.join(REGISTRY_DIR, REGISTRY_FILE);
const LOCK_PATH = path.join(REGISTRY_DIR, LOCK_FILE);

let cachedRegistry: Registry | null = null;

/**
 * Ensure the registry directory exists
 */
function ensureRegistryDir(): void {
  if (!existsSync(REGISTRY_DIR)) {
    mkdirSync(REGISTRY_DIR, { recursive: true });
  }
}

/**
 * Acquire a simple file lock for concurrent write protection
 * Uses a spin-lock approach for simplicity
 */
function acquireLock(timeout: number = 5000): boolean {
  const start = Date.now();
  while (existsSync(LOCK_PATH)) {
    if (Date.now() - start > timeout) {
      return false;
    }
    // Brief sleep to avoid CPU spinning
    const startSpin = Date.now();
    while (Date.now() - startSpin < 10) {
      // spin
    }
  }
  try {
    writeFileSync(LOCK_PATH, String(process.pid), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Release the file lock
 */
function releaseLock(): void {
  try {
    if (existsSync(LOCK_PATH)) {
      // Only remove if we own the lock
      const lockContent = readFileSync(LOCK_PATH, 'utf-8');
      if (lockContent === String(process.pid)) {
        const { unlinkSync } = require('node:fs');
        unlinkSync(LOCK_PATH);
      }
    }
  } catch {
    // Ignore errors on release
  }
}

/**
 * Load registry from disk, with caching
 */
export function loadRegistry(): Registry {
  if (cachedRegistry) {
    return cachedRegistry;
  }

  ensureRegistryDir();

  try {
    if (existsSync(REGISTRY_PATH)) {
      const content = readFileSync(REGISTRY_PATH, 'utf-8');
      cachedRegistry = JSON.parse(content) as Registry;
    } else {
      cachedRegistry = { agents: {}, version: 1 };
    }
  } catch (e) {
    console.error('[Registry] Failed to load registry:', e);
    cachedRegistry = { agents: {}, version: 1 };
  }

  return cachedRegistry;
}

/**
 * Save registry to disk atomically (write to temp then rename)
 */
export function saveRegistry(): boolean {
  if (!cachedRegistry) {
    return false;
  }

  ensureRegistryDir();

  if (!acquireLock()) {
    console.error('[Registry] Could not acquire lock for save');
    return false;
  }

  try {
    const tempPath = path.join(REGISTRY_DIR, `registry.tmp.${Date.now()}`);
    writeFileSync(tempPath, JSON.stringify(cachedRegistry, null, 2), 'utf-8');
    renameSync(tempPath, REGISTRY_PATH);
    return true;
  } catch (e) {
    console.error('[Registry] Failed to save registry:', e);
    return false;
  } finally {
    releaseLock();
  }
}

/**
 * Register a new agent or update existing one
 */
export function registerAgent(sessionId: string, info: AgentInfo): boolean {
  const registry = loadRegistry();
  registry.agents[sessionId] = info;
  cachedRegistry = registry;
  return saveRegistry();
}

/**
 * Unregister an agent by sessionId
 */
export function unregisterAgent(sessionId: string): boolean {
  const registry = loadRegistry();
  if (!registry.agents[sessionId]) {
    return false;
  }
  delete registry.agents[sessionId];
  cachedRegistry = registry;
  return saveRegistry();
}

/**
 * Get agent info by sessionId
 */
export function getAgent(sessionId: string): AgentInfo | null {
  const registry = loadRegistry();
  return registry.agents[sessionId] || null;
}

/**
 * List all agents, optionally filtered by status or type
 */
export function listAgents(
  filter?: Partial<Pick<AgentInfo, 'status' | 'type'>>
): AgentInfo[] {
  const registry = loadRegistry();
  const agents = Object.values(registry.agents);

  if (!filter) {
    return agents;
  }

  return agents.filter((agent) => {
    if (filter.status && agent.status !== filter.status) {
      return false;
    }
    if (filter.type && agent.type !== filter.type) {
      return false;
    }
    return true;
  });
}
