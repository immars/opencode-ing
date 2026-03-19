/**
 * Heartbeat Detection and Recovery Module
 *
 * Periodically checks agent process health and updates registry status.
 */

import { listAgents, saveRegistry } from '../cli/registry.js';
import { isProcessRunning } from '../cli/process.js';

let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Check all running agents and update status if process is dead
 */
function checkAgents(): void {
  const runningAgents = listAgents({ status: 'running' });
  let hasChanges = false;

  for (const agent of runningAgents) {
    if (!isProcessRunning(agent.pid)) {
      agent.status = 'error';
      hasChanges = true;
      console.error(`[Heartbeat] Agent ${agent.sessionId} (PID ${agent.pid}) is dead, marking as error`);
    }
  }

  if (hasChanges) {
    saveRegistry();
  }
}

/**
 * Start periodic heartbeat check
 * @param intervalMs - Check interval in milliseconds (default: 30000)
 */
export function startHeartbeat(intervalMs: number = 30000): void {
  if (heartbeatInterval !== null) {
    console.warn('[Heartbeat] Heartbeat already running, ignoring start request');
    return;
  }

  console.log(`[Heartbeat] Starting heartbeat with interval ${intervalMs}ms`);
  heartbeatInterval = setInterval(checkAgents, intervalMs);
}

/**
 * Stop the heartbeat check
 */
export function stopHeartbeat(): void {
  if (heartbeatInterval === null) {
    console.warn('[Heartbeat] Heartbeat not running, ignoring stop request');
    return;
  }

  clearInterval(heartbeatInterval);
  heartbeatInterval = null;
  console.log('[Heartbeat] Stopped heartbeat');
}
