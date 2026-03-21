import { unregisterAgent, listAgents, syncWithTmux } from '../registry.js';
import { killTmuxSession, isSessionRunning } from '../process.js';

export async function stopCommand(targetPath: string): Promise<void> {
  syncWithTmux();
  const agents = listAgents({ status: 'running' });
  const agent = agents.find((a) => a.path === targetPath);

  if (!agent) {
    throw new Error(`No agent running at ${targetPath}`);
  }

  if (!agent.tmuxSession) {
    throw new Error(`Agent at ${targetPath} has no tmux session`);
  }

  const killed = killTmuxSession(agent.tmuxSession);
  if (!killed) {
    throw new Error(`Failed to kill tmux session ${agent.tmuxSession} for agent at ${targetPath}`);
  }

  const unregistered = unregisterAgent(agent.sessionId);
  if (!unregistered) {
    throw new Error(`tmux session killed but failed to unregister agent ${agent.sessionId}`);
  }

  console.log(`Agent at ${targetPath} stopped (tmux: ${agent.tmuxSession})`);
}
