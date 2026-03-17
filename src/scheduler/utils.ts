import { parseCronFile, getActiveTasks } from '../memory/cron.js';
import type { CronTask } from '../memory/types.js';

export function getActiveTasksFromContent(content: string, now: Date): CronTask[] {
  const tasks = parseCronFile(content);
  return getActiveTasks(tasks.filter(t => t.enabled), now);
}

export async function executeAgentPrompt(
  client: any,
  sessionId: string,
  promptText: string
): Promise<any> {
  return client.session.prompt({
    path: { id: sessionId },
    body: {
      agent: 'assistant',
      parts: [{ type: 'text', text: promptText }],
    },
  });
}
