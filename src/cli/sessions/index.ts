import type { SessionProvider, SessionProviderFactory } from './provider.js';
import type { AgentType } from './types.js';
import { openCodeSessionProvider } from './opencode.js';
import { claudeCodeSessionProvider } from './claude-code.js';

const providers: SessionProvider[] = [
  openCodeSessionProvider,
  claudeCodeSessionProvider,
];

export function getProvider(agentType: AgentType): SessionProvider | null {
  return providers.find(p => p.agentType === agentType) || null;
}

export function getAvailableProviders(): SessionProvider[] {
  return providers.filter(p => p.isAvailable());
}

export function getProviderNames(): string[] {
  return providers.map(p => p.name);
}

export * from './types.js';
export * from './provider.js';
export { openCodeSessionProvider } from './opencode.js';
export { claudeCodeSessionProvider } from './claude-code.js';
