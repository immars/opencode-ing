import { listAllAgents, type AgentSessionInfo } from '../process.js';

function calculateUptime(startedAt: string | null): number {
  if (!startedAt) return 0;
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

export async function listCommand(): Promise<void> {
  const agents = listAllAgents();

  if (agents.length === 0) {
    console.log('No agents running.');
    return;
  }

  const pathWidth = Math.max(40, ...agents.map((a) => a.path.length));
  const typeWidth = 12;
  const pidWidth = 8;
  const tmuxWidth = 50;
  const uptimeWidth = 10;

  const header = [
    'Path'.padEnd(pathWidth),
    'Type'.padEnd(typeWidth),
    'PID'.padEnd(pidWidth),
    'tmux'.padEnd(tmuxWidth),
    'Uptime'.padEnd(uptimeWidth),
  ].join('  ');

  console.log(header);
  console.log('-'.repeat(header.length));

  for (const agent of agents) {
    const uptime = calculateUptime(agent.startedAt);
    const row = [
      agent.path.slice(0, pathWidth).padEnd(pathWidth),
      agent.type.padEnd(typeWidth),
      String(agent.pid ?? 'N/A').padEnd(pidWidth),
      agent.tmuxSession.slice(0, tmuxWidth).padEnd(tmuxWidth),
      formatUptime(uptime).padEnd(uptimeWidth),
    ].join('  ');
    console.log(row);
  }

  console.log('');
  console.log(`Total: ${agents.length} agent(s)`);
}

export default listCommand;
