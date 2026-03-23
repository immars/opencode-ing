import path from 'node:path';
import { getProvider, getAvailableProviders, type SessionInfo, type SessionQueryOptions, type AgentType } from '../sessions/index.js';

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.slice(0, maxLength - 3) + '...';
}

function formatSessions(sessions: SessionInfo[]): void {
  if (sessions.length === 0) {
    return;
  }

  const idWidth = 28;
  const titleWidth = 50;
  const msgWidth = 8;
  const timeWidth = 14;

  const header = [
    'Session ID'.padEnd(idWidth),
    'Title'.padEnd(titleWidth),
    'Msgs'.padEnd(msgWidth),
    'Last Active'.padEnd(timeWidth),
  ].join('  ');

  console.log(header);
  console.log('-'.repeat(header.length));

  for (const session of sessions) {
    const row = [
      session.id.padEnd(idWidth),
      truncateTitle(session.title, titleWidth).padEnd(titleWidth),
      String(session.messageCount).padEnd(msgWidth),
      formatTimestamp(session.updatedAt).padEnd(timeWidth),
    ].join('  ');
    console.log(row);
  }
}

export interface SessionsCommandOptions {
  path?: string;
  limit?: number;
  agentType?: AgentType;
}

export async function sessionsCommand(options: SessionsCommandOptions = {}): Promise<void> {
  const limit = options.limit || 20;
  const agentType = options.agentType || 'opencode';

  const provider = getProvider(agentType);

  if (!provider) {
    console.error(`[Sessions] Unknown agent type: ${agentType}`);
    console.error(`Available types: opencode, claude-code`);
    return;
  }

  if (!provider.isAvailable()) {
    console.error(`[Sessions] ${provider.name} is not available`);
    const available = getAvailableProviders();
    if (available.length > 0) {
      console.error(`Available providers: ${available.map(p => p.name).join(', ')}`);
    }
    return;
  }

  const queryOptions: SessionQueryOptions = {
    limit,
    projectPath: options.path ? path.resolve(options.path) : undefined,
  };

  const sessions = provider.querySessions(queryOptions);

  let targetDescription: string;
  if (options.path) {
    targetDescription = `project: ${queryOptions.projectPath}`;
  } else {
    targetDescription = 'all projects';
  }

  if (sessions.length === 0) {
    console.log(`No sessions found for ${targetDescription}`);
    return;
  }

  console.log(`[${provider.name}] Sessions for ${targetDescription} (showing ${sessions.length}):`);
  console.log('');

  formatSessions(sessions);

  console.log('');
  console.log(`Total: ${sessions.length} session(s)`);
}

export default sessionsCommand;
