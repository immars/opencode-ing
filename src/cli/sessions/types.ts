export interface SessionInfo {
  id: string;
  title: string;
  projectPath: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface SessionQueryOptions {
  projectPath?: string;
  limit: number;
}

export type AgentType = 'opencode' | 'claude-code';
