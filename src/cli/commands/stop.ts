/**
 * Stop Command
 *
 * Stops a running agent by finding it in the registry and killing its process.
 */

import { unregisterAgent, listAgents } from '../registry.js';
import { killProcess } from '../process.js';

export async function stopCommand(targetPath: string): Promise<void> {
  const agents = listAgents({ status: 'running' });
  const agent = agents.find((a) => a.path === targetPath);

  if (!agent) {
    console.error(`No agent running at ${targetPath}`);
    return;
  }

  const killed = killProcess(agent.pid);
  if (!killed) {
    console.error(`Failed to kill process ${agent.pid} for agent at ${targetPath}`);
    return;
  }

  const unregistered = unregisterAgent(agent.sessionId);
  if (!unregistered) {
    console.error(`Warning: Process killed but failed to unregister agent ${agent.sessionId}`);
    return;
  }

  console.log(`Agent at ${targetPath} stopped (pid: ${agent.pid})`);
}
