import { getAgentByPath, listAllAgents, type AgentSessionInfo } from '../process.js';
import path from 'node:path';

export interface StatusResult {
  type: 'opencode' | 'claude-code';
  pid: number | null;
  tmuxSession: string;
  path: string;
  startedAt: string | null;
  status: 'running' | 'stopped';
  uptime?: number;
}

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

function toStatusResult(agent: AgentSessionInfo): StatusResult {
  return {
    type: agent.type,
    pid: agent.pid,
    tmuxSession: agent.tmuxSession,
    path: agent.path,
    startedAt: agent.startedAt,
    status: 'running',
    uptime: agent.startedAt ? Date.now() - new Date(agent.startedAt).getTime() : undefined,
  };
}

function getStatusByPath(targetPath: string): StatusResult | null {
  const resolvedPath = path.resolve(targetPath);
  const agent = getAgentByPath(resolvedPath);
  
  if (!agent) {
    return null;
  }

  return toStatusResult(agent);
}

function getAllStatuses(): StatusResult[] {
  const agents = listAllAgents();
  return agents.map(toStatusResult);
}

function printSingleStatus(result: StatusResult | null, targetPath: string): void {
  if (!result) {
    console.log(`No agent found for path: ${targetPath}`);
    return;
  }

  console.log(`Agent Status:`);
  console.log(`  Type:      ${result.type}`);
  console.log(`  PID:       ${result.pid ?? 'N/A'}`);
  console.log(`  tmux:      ${result.tmuxSession || 'N/A'}`);
  console.log(`  Status:    ${result.status}`);
  if (result.startedAt) {
    console.log(`  Started:   ${result.startedAt}`);
    console.log(`  Uptime:    ${formatUptime(result.startedAt)}`);
  }
}

function printAllStatuses(results: StatusResult[]): void {
  if (results.length === 0) {
    console.log('No agents running.');
    return;
  }

  console.log(`Running Agents (${results.length}):`);
  console.log('');

  for (const result of results) {
    const statusIcon = result.status === 'running' ? '●' : '○';
    console.log(`  ${statusIcon} [${result.status.toUpperCase()}] ${result.type}`);
    console.log(`    Path:     ${result.path}`);
    console.log(`    PID:      ${result.pid ?? 'N/A'}`);
    console.log(`    tmux:     ${result.tmuxSession || 'N/A'}`);
    if (result.startedAt) {
      console.log(`    Started:  ${result.startedAt}`);
      console.log(`    Uptime:   ${formatUptime(result.startedAt)}`);
    }
    console.log('');
  }
}

export async function statusCommand(targetPath?: string): Promise<void> {
  if (targetPath) {
    const result = getStatusByPath(targetPath);
    printSingleStatus(result, targetPath);
  } else {
    const results = getAllStatuses();
    printAllStatuses(results);
  }
}
