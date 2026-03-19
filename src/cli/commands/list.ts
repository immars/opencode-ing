/**
 * List Command
 *
 * Lists all registered agents with their status and uptime.
 */

import { listAgents } from '../registry.js';
import { isProcessRunning } from '../process.js';
import type { AgentInfo } from '../registry.js';

interface AgentWithLiveStatus extends AgentInfo {
  isAlive: boolean;
  uptime: number;
}

/**
 * Calculate uptime in seconds from startedAt ISO string
 */
function calculateUptime(startedAt: string): number {
  const startTime = new Date(startedAt).getTime();
  const now = Date.now();
  return Math.floor((now - startTime) / 1000);
}

/**
 * Format uptime as human-readable string
 */
function formatUptime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Get live status for all agents
 */
function getAgentsWithLiveStatus(): AgentWithLiveStatus[] {
  const agents = listAgents();

  return agents.map((agent: AgentInfo) => {
    const isAlive = isProcessRunning(agent.pid);
    const uptime = calculateUptime(agent.startedAt);

    return {
      ...agent,
      isAlive,
      uptime,
    };
  });
}

/**
 * Format status for display
 */
function formatStatus(agent: AgentWithLiveStatus): string {
  if (!agent.isAlive && agent.status === 'running') {
    return 'zombie';
  }
  return agent.status;
}

/**
 * List all agents in a table format
 */
export async function listCommand(): Promise<void> {
  const agents = getAgentsWithLiveStatus();

  if (agents.length === 0) {
    console.log('No agents registered.');
    return;
  }

  // Calculate column widths
  const pathWidth = Math.max(40, ...agents.map((a) => a.path.length));
  const typeWidth = 12;
  const pidWidth = 8;
  const statusWidth = 10;
  const uptimeWidth = 10;

  // Print header
  const header = [
    'Path'.padEnd(pathWidth),
    'Type'.padEnd(typeWidth),
    'PID'.padEnd(pidWidth),
    'Status'.padEnd(statusWidth),
    'Uptime'.padEnd(uptimeWidth),
  ].join('  ');

  console.log(header);
  console.log('-'.repeat(header.length));

  // Print each agent
  for (const agent of agents) {
    const row = [
      agent.path.slice(0, pathWidth).padEnd(pathWidth),
      agent.type.padEnd(typeWidth),
      String(agent.pid).padEnd(pidWidth),
      formatStatus(agent).padEnd(statusWidth),
      formatUptime(agent.uptime).padEnd(uptimeWidth),
    ].join('  ');
    console.log(row);
  }

  console.log('');
  console.log(`Total: ${agents.length} agent(s)`);
}

export default listCommand;
