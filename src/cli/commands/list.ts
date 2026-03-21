import { listAgents, syncWithTmux } from '../registry.js';
import { isSessionRunning, getSessionPid } from '../process.js';
import type { AgentInfo } from '../registry.js';

interface AgentWithLiveStatus extends AgentInfo {
  isAlive: boolean;
  uptime: number;
  livePid: number | null;
}

function calculateUptime(startedAt: string): number {
  const startTime = new Date(startedAt).getTime();
  const now = Date.now();
  return Math.floor((now - startTime) / 1000);
}

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

function getAgentsWithLiveStatus(): AgentWithLiveStatus[] {
  const agents = listAgents();

  return agents.map((agent: AgentInfo) => {
    const tmuxSession = agent.tmuxSession || '';
    const isAlive = tmuxSession ? isSessionRunning(tmuxSession) : false;
    const uptime = calculateUptime(agent.startedAt);
    const livePid = tmuxSession ? getSessionPid(tmuxSession) : null;

    return {
      ...agent,
      isAlive,
      uptime,
      livePid,
    };
  });
}

function formatStatus(agent: AgentWithLiveStatus): string {
  if (!agent.isAlive && agent.status === 'running') {
    return 'zombie';
  }
  return agent.status;
}

export async function listCommand(): Promise<void> {
  syncWithTmux();
  const agents = getAgentsWithLiveStatus();

  if (agents.length === 0) {
    console.log('No agents registered.');
    return;
  }

  const pathWidth = Math.max(40, ...agents.map((a) => a.path.length));
  const typeWidth = 12;
  const pidWidth = 8;
  const tmuxWidth = 20;
  const statusWidth = 10;
  const uptimeWidth = 10;

  const header = [
    'Path'.padEnd(pathWidth),
    'Type'.padEnd(typeWidth),
    'PID'.padEnd(pidWidth),
    'tmux'.padEnd(tmuxWidth),
    'Status'.padEnd(statusWidth),
    'Uptime'.padEnd(uptimeWidth),
  ].join('  ');

  console.log(header);
  console.log('-'.repeat(header.length));

  for (const agent of agents) {
    const row = [
      agent.path.slice(0, pathWidth).padEnd(pathWidth),
      agent.type.padEnd(typeWidth),
      String(agent.livePid ?? 'N/A').padEnd(pidWidth),
      (agent.tmuxSession || 'N/A').slice(0, tmuxWidth).padEnd(tmuxWidth),
      formatStatus(agent).padEnd(statusWidth),
      formatUptime(agent.uptime).padEnd(uptimeWidth),
    ].join('  ');
    console.log(row);
  }

  console.log('');
  console.log(`Total: ${agents.length} agent(s)`);
}

export default listCommand;
