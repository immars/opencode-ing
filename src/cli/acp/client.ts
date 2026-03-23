/**
 * ACP Protocol Client
 *
 * Implements JSON-RPC 2.0 client for Agent Client Protocol over stdio.
 * Based on: https://agentclientprotocol.com/protocol/schema.md
 */

import { spawn, ChildProcess } from 'node:child_process';
import { Readable, Writable } from 'node:stream';

import type {
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  PromptRequest,
  PromptResponse,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  ContentBlock,
  McpServer,
  SessionUpdateNotification,
  CancelNotification,
} from './types.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  method: string;
}

type SessionUpdateHandler = (update: SessionUpdateNotification) => void;

export class ACPClient {
  private proc: ChildProcess | null = null;
  private readonly command: string;
  private readonly args: string[];
  private requestId = 0;
  private readonly pendingRequests = new Map<number | string, PendingRequest>();
  private sessionUpdateHandler: SessionUpdateHandler | null = null;
  private stdoutBuffer = '';

  constructor(command: string, args: string[]) {
    this.command = command;
    this.args = args;
  }

  /**
   * Start the subprocess
   */
  private start(): void {
    if (this.proc) {
      return;
    }

    this.proc = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout?.on('data', (chunk: Buffer | string) => {
      this.stdoutBuffer += chunk.toString();
      this.processBuffer();
    });

    this.proc.stderr?.on('data', (chunk: Buffer | string) => {
      console.error('[ACPClient] stderr:', chunk.toString());
    });

    this.proc.on('error', (err) => {
      console.error('[ACPClient] process error:', err);
      this.rejectAllPending(err);
    });

    this.proc.on('exit', (code, signal) => {
      console.log(`[ACPClient] process exited with code ${code}, signal ${signal}`);
      this.rejectAllPending(new Error(`Process exited with code ${code}, signal ${signal}`));
      this.proc = null;
    });
  }

  /**
   * Process the stdout buffer, extracting complete JSON messages
   */
  private processBuffer(): void {
    // Try to extract complete JSON objects from the buffer
    // Messages are separated by newlines
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      try {
        const msg = JSON.parse(line);
        this.handleMessage(msg);
      } catch (e) {
        console.error('[ACPClient] Failed to parse message:', line);
      }
    }
  }

  /**
   * Handle incoming JSON-RPC message
   */
  private handleMessage(msg: JSONRPCResponse | JSONRPCNotification): void {
    // Check if it's a notification (no id) or response (has id)
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
      } else {
        console.warn('[ACPClient] Unexpected response with id:', msg.id);
      }
    } else if ('method' in msg) {
      // It's a notification
      this.handleNotification(msg as JSONRPCNotification);
    }
  }

  /**
   * Handle incoming notification
   */
  private handleNotification(notification: JSONRPCNotification): void {
    const method = notification.method;

    if ((method === 'notifications/session_update' || method === 'session/update') && notification.params) {
      const update = notification.params as unknown as SessionUpdateNotification;
      if (this.sessionUpdateHandler) {
        this.sessionUpdateHandler(update);
      }
    } else if (method === 'notifications/cancelled' || method === 'session/cancelled') {
      const cancel = notification.params as unknown as CancelNotification;
      console.log('[ACPClient] Session cancelled:', cancel.sessionId);
    }
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private sendRequest<T>(method: string, params?: unknown): Promise<T> {
    if (!this.proc || !this.proc.stdin) {
      this.start();
    }

    return new Promise((resolve, reject) => {
      if (!this.proc || !this.proc.stdin) {
        reject(new Error('Process not started'));
        return;
      }

      const id = ++this.requestId;
      const request: JSONRPCRequest<typeof params> = {
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

      try {
        this.proc.stdin.write(JSON.stringify(request) + '\n');
      } catch (e) {
        this.pendingRequests.delete(id);
        reject(e);
      }
    });
  }

  /**
   * Initialize the connection
   */
  async initialize(): Promise<InitializeResponse> {
    const request: InitializeRequest = {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: {
        name: 'acp-client',
        version: '1.0.0',
      },
    };

    return this.sendRequest<InitializeResponse>('initialize', request);
  }

  /**
   * Create a new session
   */
  async sessionNew(cwd: string, mcpServers?: McpServer[]): Promise<NewSessionResponse> {
    const request: NewSessionRequest = {
      cwd,
      mcpServers,
    };

    return this.sendRequest<NewSessionResponse>('session/new', request);
  }

  /**
   * Load an existing session
   */
  async sessionLoad(sessionId: string, cwd: string, mcpServers?: McpServer[]): Promise<LoadSessionResponse> {
    const request: LoadSessionRequest = {
      sessionId,
      cwd,
      mcpServers,
    };

    return this.sendRequest<LoadSessionResponse>('session/load', request);
  }

  /**
   * Send a prompt to a session
   */
  async sessionPrompt(sessionId: string, prompt: ContentBlock[]): Promise<PromptResponse> {
    const request: PromptRequest = {
      sessionId,
      prompt,
    };

    return this.sendRequest<PromptResponse>('session/prompt', request);
  }

  /**
   * Cancel a session
   */
  sessionCancel(sessionId: string): void {
    if (!this.proc || !this.proc.stdin) {
      console.warn('[ACPClient] Cannot cancel: process not running');
      return;
    }

    const notification: JSONRPCNotification<CancelNotification> = {
      jsonrpc: '2.0',
      method: 'notifications/cancel',
      params: { sessionId },
    };

    this.proc.stdin.write(JSON.stringify(notification) + '\n');
  }

  /**
   * Set handler for session update notifications
   */
  onSessionUpdate(handler: SessionUpdateHandler): void {
    this.sessionUpdateHandler = handler;
  }

  /**
   * Close the client and terminate the subprocess
   */
  close(): void {
    if (this.proc) {
      this.proc.stdin?.end();
      this.proc.kill();
      this.proc = null;
    }
    this.pendingRequests.clear();
  }

  /**
   * Reject all pending requests with an error
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
