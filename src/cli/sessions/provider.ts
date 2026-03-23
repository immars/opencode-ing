import type { SessionInfo, SessionQueryOptions, AgentType } from './types.js';

export interface SessionProvider {
  readonly name: string;
  readonly agentType: AgentType;
  
  isAvailable(): boolean;
  
  querySessions(options: SessionQueryOptions): SessionInfo[];
}

export type SessionProviderFactory = (agentType: AgentType) => SessionProvider | null;
