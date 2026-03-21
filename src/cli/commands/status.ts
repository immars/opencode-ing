import { listAgents, getAgent, syncWithTmux } from '../registry.js';
import { isSessionRunning, getSessionPid } from '../process.js';
import path from 'node:path';

export interface StatusResult {
  sessionId: string;
  type: 'opencode' | 'claude-code';
  pid: number | null;
  tmuxSession: string;
  path: string;
  startedAt: string;
  status: 'running' | 'stopped' | 'error';
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

function getStatusByPath(targetPath: string): StatusResult | null {
  const agents = listAgents();
  const resolvedPath = path.resolve(targetPath);

  const agent = agents.find((a) => path.resolve(a.path) === resolvedPath);
  if (!agent) {
    return null;
  }

  const tmuxSession = agent.tmuxSession || '';
  const isAlive = tmuxSession ? isSessionRunning(tmuxSession) : false;
  const status = isAlive ? 'running' : 'error';
  const currentPid = tmuxSession ? getSessionPid(tmuxSession) : null;

  return {
    sessionId: agent.sessionId,
    type: agent.type,
    pid: currentPid,
    tmuxSession,
    path: agent.path,
    startedAt: agent.startedAt,
    status,
    uptime: isAlive ? Date.now() - new Date(agent.startedAt).getTime() : undefined,
  };
}

function getAllStatuses(): StatusResult[] {
  const agents = listAgents();

  return agents.map((agent) => {
    const tmuxSession = agent.tmuxSession || '';
    const isAlive = tmuxSession ? isSessionRunning(tmuxSession) : false;
    const status = isAlive ? 'running' : agent.status === 'running' ? 'error' : agent.status;
    const currentPid = tmuxSession ? getSessionPid(tmuxSession) : null;

    return {
      sessionId: agent.sessionId,
      type: agent.type,
      pid: currentPid,
      tmuxSession,
      path: agent.path,
      startedAt: agent.startedAt,
      status,
      uptime: isAlive ? Date.now() - new Date(agent.startedAt).getTime() : undefined,
    };
  });
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
  console.log(`  Session:   ${result.sessionId}`);
  console.log(`  Status:    ${result.status}`);
  console.log(`  Started:   ${result.startedAt}`);
  if (result.uptime !== undefined) {
    console.log(`  Uptime:    ${formatUptime(result.startedAt)}`);
  }
}

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
    console.log(`    Path:     ${result.path}`);
    console.log(`    PID:      ${result.pid ?? 'N/A'}`);
    console.log(`    tmux:     ${result.tmuxSession || 'N/A'}`);
    console.log(`    Session:  ${result.sessionId}`);
    console.log(`    Started:  ${result.startedAt}`);
    if (result.uptime !== undefined) {
      console.log(`    Uptime:   ${formatUptime(result.startedAt)}`);
    }
    console.log('');
  }
}

export async function statusCommand(targetPath?: string): Promise<void> {
  syncWithTmux();
  if (targetPath) {
    const result = getStatusByPath(targetPath);
    printSingleStatus(result, targetPath);
  } else {
    const results = getAllStatuses();
    printAllStatuses(results);
  }
}
