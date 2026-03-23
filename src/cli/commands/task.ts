import path from 'node:path';
import { parseTaskFile, writeTaskResult, type TaskFile, type TaskResult } from '../task-file.js';
import { getAgentByPath, type AgentSessionInfo } from '../process.js';
import { TmuxACPClient } from '../acp/tmux-client.js';

export interface TaskCommandOptions {
  targetPath: string;
  taskFilePath: string;
}

function buildPrompt(task: TaskFile): { type: string; text: string }[] {
  const blocks: { type: string; text: string }[] = [];

  blocks.push({
    type: 'text',
    text: `Task: ${task.description}`,
  });

  if (task.requirements.length > 0) {
    const requirementsText = task.requirements
      .map((req, i) => `${i + 1}. ${req}`)
      .join('\n');
    blocks.push({
      type: 'text',
      text: `Requirements:\n${requirementsText}`,
    });
  }

  if (task.context.instructions) {
    blocks.push({
      type: 'text',
      text: `Context:\n${task.context.instructions}`,
    });
  }

  if (task.context.files && task.context.files.length > 0) {
    blocks.push({
      type: 'text',
      text: `Files to reference:\n${task.context.files.join('\n')}`,
    });
  }

  return blocks;
}

export async function taskCommand(targetPath: string, taskFilePath: string): Promise<void> {
  const absolutePath = path.resolve(targetPath);
  const absoluteTaskFilePath = path.resolve(taskFilePath);

  console.log(`[Task] Sending task from: ${absoluteTaskFilePath}`);
  console.log(`[Task] Target agent path: ${absolutePath}`);

  const task = parseTaskFile(absoluteTaskFilePath);
  if (!task) {
    throw new Error(`Failed to parse task file: ${absoluteTaskFilePath}`);
  }

  console.log(`[Task] Loaded task: ${task.taskId}`);
  console.log(`[Task] Description: ${task.description}`);

  const agent = getAgentByPath(absolutePath);

  if (!agent) {
    throw new Error(`No agent running at ${absolutePath}`);
  }

  console.log(`[Task] Found agent: ${agent.type} (tmux: ${agent.tmuxSession})`);

  const client = new TmuxACPClient(agent.tmuxSession, agent.type);

  try {
    console.log('[Task] Initializing ACP connection...');
    await client.initialize();
    console.log('[Task] ACP connection initialized');

    console.log('[Task] Creating new session...');
    const sessionResponse = await client.sessionNew(absolutePath);
    console.log('[Task] Session created:', sessionResponse.sessionId);

    const promptBlocks = buildPrompt(task);
    console.log(`[Task] Built prompt with ${promptBlocks.length} content blocks`);

    const responseChunks: string[] = [];
    client.onSessionUpdate((update: unknown) => {
      const u = update as { method?: string; params?: { update?: { sessionUpdate?: string; content?: { type?: string; text?: string } } } };
      if (u.params?.update?.sessionUpdate === 'agent_message_chunk') {
        const content = u.params.update.content;
        if (content?.type === 'text' && content.text) {
          responseChunks.push(content.text);
        }
      }
    });

    console.log('[Task] Sending prompt to agent...');
    const response = await client.sessionPrompt(sessionResponse.sessionId, promptBlocks);

    console.log(`[Task] Received response, stopReason: ${response.stopReason}`);

    const outputPath = absoluteTaskFilePath.replace(/\.json$/, '') + '.result.json';

    const taskResult: TaskResult = {
      taskId: task.taskId,
      status: response.stopReason === 'end_turn' ? 'success' : 'failure',
      output: responseChunks.join(''),
      completedAt: new Date().toISOString(),
    };

    const written = writeTaskResult(outputPath, taskResult);
    if (!written) {
      throw new Error(`Failed to write task result to: ${outputPath}`);
    }

    console.log('');
    console.log('========================================');
    console.log('Task completed successfully!');
    console.log('========================================');
    console.log(`Task ID: ${task.taskId}`);
    console.log(`Status: ${taskResult.status}`);
    console.log(`Result file: ${outputPath}`);
    console.log('========================================');
    console.log('');

  } finally {
    client.close();
  }
}

export default taskCommand;
