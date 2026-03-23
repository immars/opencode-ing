import { sendToSession, getSessionOutput, hasTmuxSession, type AgentType } from '../process.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  method: string;
}

type SessionUpdateHandler = (update: unknown) => void;

export class TmuxACPClient {
  private readonly sessionName: string;
  private readonly agentType: AgentType;
  private requestId = 0;
  private readonly pendingRequests = new Map<number | string, PendingRequest>();
  private sessionUpdateHandler: SessionUpdateHandler | null = null;
  private outputBuffer = '';
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(sessionName: string, agentType: AgentType) {
    this.sessionName = sessionName;
    this.agentType = agentType;
  }

  private pollOutput(): void {
    const output = getSessionOutput(this.sessionName, 200);
    const newContent = output.slice(this.outputBuffer.length);
    this.outputBuffer = output;

    if (newContent) {
      const lines = newContent.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          this.handleMessage(msg);
        } catch {
          void 0;
        }
      }
    }
  }

  private startPolling(): void {
    if (this.pollInterval) return;
    
    this.outputBuffer = getSessionOutput(this.sessionName, 200);
    
    this.pollInterval = setInterval(() => {
      this.pollOutput();
    }, 100);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private handleMessage(msg: { id?: number | string; error?: { code: number; message: string }; result?: unknown; method?: string }): void {
    if ('id' in msg && msg.id !== undefined) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(`JSON-RPC error: ${msg.error.code} - ${msg.error.message}`));
        } else if ('result' in msg) {
          pending.resolve(msg.result);
        } else {
          pending.reject(new Error('Invalid response: no result or error'));
        }
      }
    } else if ('method' in msg && msg.method && this.sessionUpdateHandler) {
      this.sessionUpdateHandler(msg);
    }
  }

  private async sendRequest<T>(method: string, params?: unknown, timeoutMs: number = 30000): Promise<T> {
    if (!hasTmuxSession(this.sessionName)) {
      throw new Error(`tmux session ${this.sessionName} does not exist`);
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        method,
      });

      const requestStr = JSON.stringify(request);
      const sent = sendToSession(this.sessionName, requestStr);
      if (!sent) {
        this.pendingRequests.delete(id);
        reject(new Error('Failed to send request to tmux session'));
        return;
      }

      setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });
  }

  async initialize(): Promise<{ protocolVersion: number }> {
    this.startPolling();
    
    const request = {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: {
        name: 'tmux-acp-client',
        version: '1.0.0',
      },
    };

    return this.sendRequest<{ protocolVersion: number }>('initialize', request);
  }

  async sessionNew(cwd: string): Promise<{ sessionId: string }> {
    return this.sendRequest<{ sessionId: string }>('session/new', { cwd });
  }

  async sessionLoad(sessionId: string, cwd: string): Promise<{ sessionId: string }> {
    return this.sendRequest<{ sessionId: string }>('session/load', { sessionId, cwd });
  }

  async sessionPrompt(sessionId: string, prompt: { type: string; text: string }[]): Promise<{ stopReason: string }> {
    return this.sendRequest<{ stopReason: string }>('session/prompt', { sessionId, prompt });
  }

  onSessionUpdate(handler: SessionUpdateHandler): void {
    this.sessionUpdateHandler = handler;
  }

  close(): void {
    this.stopPolling();
    this.pendingRequests.clear();
  }
}
