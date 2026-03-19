/**
 * Status Command Module
 *
 * Displays status information for agents, either a specific one or all.
 */

import { listAgents, getAgent } from '../registry.js';
import { isProcessRunning } from '../process.js';
import path from 'node:path';

export interface StatusResult {
  sessionId: string;
  type: 'opencode' | 'claude-code';
  pid: number;
  sessionId_2: string;
  startedAt: string;
  status: 'running' | 'stopped' | 'error';
  uptime?: number;
}

/**
 * Format uptime in human-readable form
 */
function formatUptime(startedAt: string): string {
  const startTime = new Date(startedAt).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - startTime) / 1000);

  if (elapsed < 0) {
    return 'unknown';
  }

  const seconds = elapsed % 60;
  const minutes = Math.floor(elapsed / 60) % 60;
  const hours = Math.floor(elapsed / 3600) % 24;
  const days = Math.floor(elapsed / 86400);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Get status for a specific agent by path
 */
function getStatusByPath(targetPath: string): StatusResult | null {
  const agents = listAgents();
  const resolvedPath = path.resolve(targetPath);

  const agent = agents.find((a) => path.resolve(a.path) === resolvedPath);
  if (!agent) {
    return null;
  }

  const isAlive = isProcessRunning(agent.pid);
  const status = isAlive ? 'running' : 'error';

  return {
    sessionId: agent.sessionId,
    type: agent.type,
    pid: agent.pid,
    sessionId_2: agent.sessionId,
    startedAt: agent.startedAt,
    status,
    uptime: isAlive ? Date.now() - new Date(agent.startedAt).getTime() : undefined,
  };
}

/**
 * Get status for all agents
 */
function getAllStatuses(): StatusResult[] {
  const agents = listAgents();

  return agents.map((agent) => {
    const isAlive = isProcessRunning(agent.pid);
    const status = isAlive ? 'running' : agent.status === 'running' ? 'error' : agent.status;

    return {
      sessionId: agent.sessionId,
      type: agent.type,
      pid: agent.pid,
      sessionId_2: agent.sessionId,
      startedAt: agent.startedAt,
      status,
      uptime: isAlive ? Date.now() - new Date(agent.startedAt).getTime() : undefined,
    };
  });
}

/**
 * Print status for a single agent
 */
function printSingleStatus(result: StatusResult | null, targetPath: string): void {
  if (!result) {
    console.log(`No agent found for path: ${targetPath}`);
    return;
  }

  console.log(`Agent Status:`);
  console.log(`  Type:      ${result.type}`);
  console.log(`  PID:       ${result.pid}`);
  console.log(`  Session:   ${result.sessionId}`);
  console.log(`  Status:    ${result.status}`);
  console.log(`  Started:   ${result.startedAt}`);
  if (result.uptime !== undefined) {
    console.log(`  Uptime:    ${formatUptime(result.startedAt)}`);
  }
}

/**
 * Print status for all agents
 */
function printAllStatuses(results: StatusResult[]): void {
  if (results.length === 0) {
    console.log('No agents registered.');
    return;
  }

  console.log(`Registered Agents (${results.length}):`);
  console.log('');

  for (const result of results) {
    const statusIcon = result.status === 'running' ? '●' : '○';
    console.log(`  ${statusIcon} [${result.status.toUpperCase()}] ${result.type}`);
    console.log(`    Path:     ${result.sessionId}`);
    console.log(`    PID:      ${result.pid}`);
    console.log(`    Session: ${result.sessionId_2}`);
    console.log(`    Started: ${result.startedAt}`);
    if (result.uptime !== undefined) {
      console.log(`    Uptime:  ${formatUptime(result.startedAt)}`);
    }
    console.log('');
  }
}

/**
 * Status command implementation
 * If targetPath provided: find agent by path and show its status
 * Otherwise: list all agents with their status
 */
export async function statusCommand(targetPath?: string): Promise<void> {
  if (targetPath) {
    const result = getStatusByPath(targetPath);
    printSingleStatus(result, targetPath);
  } else {
    const results = getAllStatuses();
    printAllStatuses(results);
  }
}
