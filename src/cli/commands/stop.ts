import { killTmuxSession, getAgentByPath } from '../process.js';

export async function stopCommand(targetPath: string): Promise<void> {
  const agent = getAgentByPath(targetPath);

  if (!agent) {
    throw new Error(`No agent running at ${targetPath}`);
  }

  const killed = killTmuxSession(agent.tmuxSession);
  if (!killed) {
    throw new Error(`Failed to kill tmux session ${agent.tmuxSession} for agent at ${targetPath}`);
  }

  console.log(`Agent at ${targetPath} stopped (tmux: ${agent.tmuxSession})`);
}
