import path from 'node:path';
import { getAgentByPath } from '../process.js';
import { ACPClient } from '../acp/client.js';
import { getLatestSessionId } from '../sessions/opencode.js';

export interface ChatCommandOptions {
  targetPath: string;
  message: string;
}

export async function chatCommand(targetPath: string, message: string): Promise<void> {
  const absolutePath = path.resolve(targetPath);
  const agent = getAgentByPath(absolutePath);

  if (!agent) {
    throw new Error(`No agent running at ${absolutePath}`);
  }

  let command: string;
  let args: string[];

  if (agent.type === 'opencode') {
    command = 'opencode';
    args = ['acp'];
  } else if (agent.type === 'claude-code') {
    command = 'claude';
    args = ['code', '--agent'];
  } else {
    throw new Error(`Unknown agent type: ${agent.type}`);
  }

  const client = new ACPClient(command, args);
  let sessionId: string;

  try {
    console.log('[Chat] Connecting to agent...');
    await client.initialize();

    client.onSessionUpdate((update) => {
      if (update.update.sessionUpdate === 'agent_message_chunk') {
        const content = update.update.content as { type: string; text?: string };
        if (content.type === 'text' && content.text) {
          process.stdout.write(content.text);
        }
      }
    });

    const existingSessionId = getLatestSessionId(absolutePath);
    
    if (existingSessionId) {
      console.log('[Chat] Loading session:', existingSessionId);
      await client.sessionLoad(existingSessionId, absolutePath, []);
      sessionId = existingSessionId;
    } else {
      console.log('[Chat] Creating new session...');
      const sessionResponse = await client.sessionNew(absolutePath, []);
      sessionId = sessionResponse.sessionId;
      console.log('[Chat] Session created:', sessionId);
    }

    console.log('[Chat] Sending message...\n');
    const response = await client.sessionPrompt(sessionId, [{ type: 'text', text: message }]);

    console.log('\n');
    console.log(`[Chat] Completed (stopReason: ${response.stopReason})`);

  } finally {
    client.close();
  }
}

export default chatCommand;
