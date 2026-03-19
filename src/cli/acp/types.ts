/**
 * ACP Protocol Type Definitions
 *
 * Implements JSON-RPC 2.0 and Agent Client Protocol types.
 * Based on: https://agentclientprotocol.com/protocol/schema.md
 */

// JSON-RPC 2.0 Base Types

export interface JSONRPCRequest<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: T;
}

export interface JSONRPCResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: JSONRPCError;
}

export interface JSONRPCNotification<T = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

// Content Block Types

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ImageContentBlock {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type: string;
    data: string;
  };
}

export interface ResourceContentBlock {
  type: 'resource';
  resource: {
    uri: string;
    mime_type?: string;
    text?: string;
  };
}

export type ContentBlock = TextContentBlock | ImageContentBlock | ResourceContentBlock;

// Implementation Info

export interface Implementation {
  name: string;
  version?: string;
  title?: string;
}

// Client Capabilities

export interface FsCapabilities {
  readTextFile?: boolean;
  writeTextFile?: boolean;
}

export interface ClientCapabilities {
  fs?: FsCapabilities;
  terminal?: boolean;
}

// Agent Capabilities

export interface PromptCapabilities {
  image?: boolean;
  audio?: boolean;
  embeddedContext?: boolean;
}

export interface McpCapabilities {
  http?: boolean;
  sse?: boolean;
}

export interface AgentCapabilities {
  loadSession?: boolean;
  promptCapabilities?: PromptCapabilities;
  mcp?: McpCapabilities;
}

export type AuthMethod = 'none' | 'oauth' | 'api_key' | string;

// Initialize

export interface InitializeRequest {
  protocolVersion: number;
  clientCapabilities?: ClientCapabilities;
  clientInfo?: Implementation;
}

export interface InitializeResponse {
  protocolVersion: number;
  agentCapabilities?: AgentCapabilities;
  agentInfo?: Implementation;
  authMethods?: AuthMethod[];
}

// Session Types

export interface McpServer {
  name: string;
  command: string;
  args: string[];
  env?: Array<{ name: string; value: string }>;
  type?: 'stdio' | 'http' | 'sse';
  url?: string;
  headers?: Array<{ name: string; value: string }>;
}

export interface NewSessionRequest {
  cwd: string;
  mcpServers?: McpServer[];
}

export interface NewSessionResponse {
  sessionId: string;
  configOptions?: SessionConfigOption[];
  modes?: SessionModeState;
}

export interface LoadSessionRequest {
  sessionId: string;
  cwd: string;
  mcpServers?: McpServer[];
}

export interface LoadSessionResponse {
  configOptions?: SessionConfigOption[];
  modes?: SessionModeState;
}

// Prompt

export interface PromptRequest {
  sessionId: string;
  prompt: ContentBlock[];
}

export type StopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'max_turn_requests'
  | 'refusal'
  | 'cancelled';

export interface PromptResponse {
  stopReason: StopReason;
}

// Session Update

export type SessionUpdate =
  | { sessionUpdate: 'user_message_chunk'; content: ContentBlock }
  | { sessionUpdate: 'agent_message_chunk'; content: ContentBlock }
  | { sessionUpdate: 'plan'; entries: PlanEntry[] }
  | { sessionUpdate: 'tool_call'; toolCallId: string; title: string; kind: string; status: 'pending' }
  | { sessionUpdate: 'tool_call_update'; toolCallId: string; status: string; content?: ContentBlock[] }
  | { sessionUpdate: 'message_id'; id: string }
  | { sessionUpdate: 'available_commands'; commands: string[] }
  | { sessionUpdate: 'current_mode_update'; mode: string };

export interface SessionUpdateNotification {
  sessionId: string;
  update: SessionUpdate;
}

export interface PlanEntry {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: 'high' | 'medium' | 'low';
}

// Session Cancel

export interface CancelNotification {
  sessionId: string;
}

// Session Config

export interface SessionConfigOption {
  id: string;
  label: string;
  options: Array<{ id: string; label: string }>;
}

export interface SetSessionConfigOptionRequest {
  sessionId: string;
  configId: string;
  value: string;
}

export interface SetSessionConfigOptionResponse {
  configOptions: SessionConfigOption[];
}

export interface SessionModeState {
  availableModes: Array<{ id: string; label: string }>;
  currentMode: string;
}

export interface SetSessionModeRequest {
  sessionId: string;
  modeId: string;
}

export interface SetSessionModeResponse {
  modes: SessionModeState;
}

// File System Operations

export interface ReadTextFileRequest {
  sessionId: string;
  path: string;
  limit?: number;
  line?: number;
}

export interface ReadTextFileResponse {
  content: string;
}

export interface WriteTextFileRequest {
  sessionId: string;
  path: string;
  content: string;
}

export interface WriteTextFileResponse {
  // Empty on success
}

// Terminal Operations

export interface CreateTerminalRequest {
  sessionId: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Array<{ name: string; value: string }>;
  outputByteLimit?: number;
}

export interface CreateTerminalResponse {
  terminalId: string;
}

export interface TerminalOutputRequest {
  sessionId: string;
  terminalId: string;
}

export interface TerminalExitStatus {
  code: number | null;
  signal: string | null;
}

export interface TerminalOutputResponse {
  output: string;
  exitStatus: TerminalExitStatus | null;
  truncated: boolean;
}

export interface ReleaseTerminalRequest {
  sessionId: string;
  terminalId: string;
}

export interface KillTerminalRequest {
  sessionId: string;
  terminalId: string;
}

// Permission Requests

export interface PermissionOption {
  id: string;
  label: string;
}

export interface ToolCallUpdate {
  toolCallId: string;
  title?: string;
  kind?: string;
  status?: string;
}

export interface RequestPermissionRequest {
  sessionId: string;
  toolCall: ToolCallUpdate;
  options: PermissionOption[];
}

export type RequestPermissionOutcome = 'approved' | 'denied' | 'cancelled';

export interface RequestPermissionResponse {
  outcome: RequestPermissionOutcome;
}
