import { listAgents, saveRegistry } from '../cli/registry.js';
import { isSessionRunning } from '../cli/process.js';

let heartbeatInterval: NodeJS.Timeout | null = null;

function checkAgents(): void {
  const runningAgents = listAgents({ status: 'running' });
  let hasChanges = false;

  for (const agent of runningAgents) {
    const tmuxSession = agent.tmuxSession || '';
    const isAlive = tmuxSession ? isSessionRunning(tmuxSession) : false;

    if (!isAlive) {
      agent.status = 'error';
      hasChanges = true;
      console.error(`[Heartbeat] Agent ${agent.sessionId} (tmux: ${tmuxSession}) is dead, marking as error`);
    }
  }

  if (hasChanges) {
    saveRegistry();
  }
}

export function startHeartbeat(intervalMs: number = 30000): void {
  if (heartbeatInterval !== null) {
    console.warn('[Heartbeat] Heartbeat already running, ignoring start request');
    return;
  }

  console.log(`[Heartbeat] Starting heartbeat with interval ${intervalMs}ms`);
  heartbeatInterval = setInterval(checkAgents, intervalMs);
}

export function stopHeartbeat(): void {
  if (heartbeatInterval === null) {
    console.warn('[Heartbeat] Heartbeat not running, ignoring stop request');
    return;
  }

  clearInterval(heartbeatInterval);
  heartbeatInterval = null;
  console.log('[Heartbeat] Stopped heartbeat');
}
