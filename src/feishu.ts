import fs from 'node:fs/promises';
import path from 'node:path';
import { loadFeishuConfig } from "./config.js";
import { logger } from "./logger.js";
import type { FeishuCard } from "./prettifier.js";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface FeishuWSClient {
  wsClient?: any;
  onMessage?: (event: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface FileUploadResult {
  fileKey: string;
  fileName: string;
}

export interface FileSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface RichTextContent {
  zh_cn: {
    title: string;
    content: Array<Array<{ tag: string; text?: string; href?: string; style?: string[] }>>;
  };
}

export interface DownloadedFile {
  buffer: Buffer;
  fileName?: string;
  contentType?: string;
}

// ============================================================================
// State & Cache
// ============================================================================

const REACTION_EMOJI = "SMILE";

/** Cached Feishu client credentials */
let cachedClient: { appId: string; appSecret: string } | null = null;

/** Project directory for cached client */
let cachedProjectDir: string | null = null;

/** Lark API client cache by app ID */
const larkClientCache = new Map<string, any>();

/** WebSocket client instance */
let feishuWSClient: any = null;

/** Heartbeat timer for connection checks */
let heartbeatTimer: NodeJS.Timeout | null = null;

export function getFeishuWSClient(): any {
  return feishuWSClient;
}

export function setFeishuWSClient(client: any): void {
  feishuWSClient = client;
}

export function getHeartbeatTimer(): NodeJS.Timeout | null {
  return heartbeatTimer;
}

export function setHeartbeatTimer(timer: NodeJS.Timeout | null): void {
  heartbeatTimer = timer;
}

// ============================================================================
// Client Initialization & Access
// ============================================================================

export function createFeishuClient(projectDir: string): { appId: string; appSecret: string } | null {
  const config = loadFeishuConfig(projectDir);
  if (!config || !config.app_id || !config.app_secret) {
    return null;
  }
  return { appId: config.app_id, appSecret: config.app_secret };
}

function getOrCreateClient(projectDir: string): { appId: string; appSecret: string } | null {
  if (cachedProjectDir === projectDir && cachedClient) {
    return cachedClient;
  }
  const client = createFeishuClient(projectDir);
  if (client) {
    cachedClient = client;
    cachedProjectDir = projectDir;
    larkClientCache.clear();
  }
  return client;
}

async function getOrCreateLarkClient(client: { appId: string; appSecret: string }): Promise<any | null> {
  const cached = larkClientCache.get(client.appId);
  if (cached) {
    return cached;
  }
  
  try {
    const lark = await import("@larksuiteoapi/node-sdk");
    const c = new lark.Client({ appId: client.appId, appSecret: client.appSecret });
    larkClientCache.set(client.appId, c);
    return c;
  } catch (e) {
    logger.error('Feishu', "Failed to create Lark client:", e);
    return null;
  }
}

async function getLarkClientByProject(projectDir: string): Promise<any | null> {
  const client = getOrCreateClient(projectDir);
  if (!client) return null;
  return getOrCreateLarkClient(client);
}

export async function getLarkClient(projectDir: string): Promise<any | null> {
  return getLarkClientByProject(projectDir);
}

async function withLarkClient<T>(
  projectDir: string,
  operation: (c: any) => Promise<T>,
  errorMsg?: string
): Promise<T | null> {
  const c = await getLarkClientByProject(projectDir);
  if (!c) return null;
  try {
    return await operation(c);
  } catch (e) {
    logger.error('Feishu', errorMsg || "Operation failed:", e);
    return null;
  }
}

export async function checkConnection(projectDir: string): Promise<boolean> {
  const result = await withLarkClient(projectDir, async (c) => {
    const result = await c.request({
      method: 'GET',
      url: '/open-apis/bot/v3/info',
    });
    return result.code === 0;
  }, "Connection check failed:");
  return result ?? false;
}

// ============================================================================
// Message Parsing & Formatting
// ============================================================================

export function parseFeishuMessageContent(rawContent: string): string {
  try {
    const parsed = JSON.parse(rawContent);
    if (parsed.text) return parsed.text;
    
    if (parsed.title !== undefined && Array.isArray(parsed.content)) {
      let text = parsed.title ? parsed.title + '\n' : '';
      for (const paragraph of parsed.content) {
        if (!Array.isArray(paragraph)) continue;
        for (const element of paragraph) {
          if (element.tag === 'text' && element.text) {
            text += element.text;
          } else if (element.tag === 'a' && element.href) {
            text += `[${element.text || element.href}](${element.href})`;
          } else if (element.tag === 'at' && element.user_id) {
            text += `@${element.user_name || element.user_id}`;
          }
        }
        text += '\n';
      }
      return text.trim() || rawContent;
    }
    
    return rawContent;
  } catch (e) {
    return rawContent;
  }
}

// ============================================================================
// Message Sending
// ============================================================================

/**
 * Send a text or rich text message to Feishu
 * @deprecated Use sendCardMessage for full markdown support
 */
export async function sendMessage(
  projectDir: string,
  chatId: string,
  content: string,
  richContent?: RichTextContent
): Promise<boolean> {
  const result = await withLarkClient(projectDir, async (c) => {
    let msgType = "text";
    let msgContent: string;
    
    if (richContent) {
      msgType = "post";
      msgContent = JSON.stringify(richContent);
    } else {
      msgContent = JSON.stringify({ text: content });
    }
    
    const result = await c.im.message.create({
      params: { receive_id_type: "chat_id" },
      data: { receive_id: chatId, msg_type: msgType, content: msgContent },
    });
    return result.code === 0;
  }, "Error sending message:");
  return result ?? false;
}

/**
 * Send an Interactive Card message to Feishu.
 * Supports full markdown including tables, code blocks, @mentions, etc.
 * 
 * @param projectDir - Project directory path
 * @param chatId - Target chat ID
 * @param card - Feishu Interactive Card (Schema 2.0)
 * @returns true if message sent successfully
 */
export async function sendCardMessage(
  projectDir: string,
  chatId: string,
  card: FeishuCard
): Promise<boolean> {
  const result = await withLarkClient(projectDir, async (c) => {
    const msgContent = JSON.stringify(card);
    const result = await c.im.message.create({
      params: { receive_id_type: "chat_id" },
      data: { 
        receive_id: chatId, 
        msg_type: "interactive", 
        content: msgContent 
      },
    });
    return result.code === 0;
  }, "Error sending card message:");
  return result ?? false;
}

/**
 * Send a markdown message as an Interactive Card.
 * This is the recommended way to send messages with formatting.
 * 
 * @param projectDir - Project directory path
 * @param chatId - Target chat ID  
 * @param markdown - Markdown content (supports tables, code blocks, @mentions)
 * @returns true if message sent successfully
 */
export async function sendMarkdownMessage(
  projectDir: string,
  chatId: string,
  markdown: string
): Promise<boolean> {
  const card: FeishuCard = {
    schema: "2.0",
    config: { wide_screen_mode: true },
    body: {
      elements: [{ tag: "markdown", content: markdown }]
    }
  };
  
  return sendCardMessage(projectDir, chatId, card);
}

async function sendFileMessage(
  projectDir: string,
  chatId: string,
  fileKey: string
): Promise<FileSendResult> {
  const result = await withLarkClient(projectDir, async (c) => {
    const res = await c.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'file',
        content: JSON.stringify({ file_key: fileKey }),
      },
    });
    
    if (res.code !== 0) {
      return {
        success: false,
        error: res.msg || 'Unknown error',
      };
    }
    
    return {
      success: true,
      messageId: res.data?.message_id,
    };
  }, `Failed to send file message to chat: ${chatId}`);
  
  return result ?? { success: false, error: 'Failed to get Lark client' };
}

// ============================================================================
// File Management
// ============================================================================

export async function uploadFile(
  projectDir: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<FileUploadResult | null> {
  const result = await withLarkClient(projectDir, async (c) => {
    const res = await c.im.file.create({
      data: {
        file_type: 'stream',
        file_name: fileName,
        file: fileBuffer,
      },
    });
    
    // im.file.create returns { file_key: '...' } directly, NOT { code, msg, data }
    if (!res?.file_key) {
      return null;
    }
    
    return {
      fileKey: res.file_key,
      fileName,
    };
  }, `Failed to upload file: ${fileName}`);
  
  return result;
}

export async function sendFileToChat(
  projectDir: string,
  chatId: string,
  filePath: string
): Promise<FileSendResult> {
  const fileName = path.basename(filePath);
  const fileBuffer = await fs.readFile(filePath);
  const uploadResult = await uploadFile(projectDir, fileName, fileBuffer);
  
  if (!uploadResult) {
    return { success: false, error: 'Failed to upload file' };
  }
  
  return sendFileMessage(projectDir, chatId, uploadResult.fileKey);
}

/**
 * 下载消息中的文件资源
 * @param projectDir - 项目目录
 * @param messageId - 消息 ID
 * @param fileKey - 文件/图片的唯一标识
 * @param type - 资源类型: 'image' 或 'file'
 * @returns 文件 Buffer 或 null
 */
export async function downloadMessageFile(
  projectDir: string,
  messageId: string,
  fileKey: string,
  type: 'image' | 'file'
): Promise<DownloadedFile | null> {
  console.error(`[Feishu] Downloading ${type}: ${fileKey}, message_id: ${messageId}`);
  
  const result = await withLarkClient(projectDir, async (c) => {
    const response = await c.im.messageResource.get({
      path: {
        message_id: messageId,
        file_key: fileKey,
      },
      params: {
        type: type,
      },
    });
    
    console.error(`[Feishu] Download response: code=${response.code}, hasData=${!!response.data}`);
    
    return {
      buffer: response.data,
      contentType: response.headers?.['content-type'],
    };
  }, `Failed to download file: ${fileKey}`);
  
  return result;
}

// ============================================================================
// Message Reactions
// ============================================================================

export async function addReaction(
  projectDir: string,
  messageId: string
): Promise<boolean> {
  const result = await withLarkClient(projectDir, async (c) => {
    const result = await c.im.messageReaction.create({
      path: { message_id: messageId },
      data: { reaction_type: { emoji_type: REACTION_EMOJI } },
    });
    return result.code === 0;
  }, "Add reaction failed:");
  return result ?? false;
}

export async function removeReaction(
  projectDir: string,
  messageId: string
): Promise<boolean> {
  const result = await withLarkClient(projectDir, async (c) => {
    const listResult = await c.im.messageReaction.list({
      path: { message_id: messageId },
    });
    if (listResult.code !== 0 || !listResult.data?.items) {
      return false;
    }
    const ourReaction = listResult.data.items.find(
      (r: any) => r.reaction_type?.emoji_type === REACTION_EMOJI
    );
    if (!ourReaction || !ourReaction.reaction_id) {
      return true;
    }
    const deleteResult = await c.im.messageReaction.delete({
      path: { message_id: messageId, reaction_id: ourReaction.reaction_id },
    });
    return deleteResult.code === 0;
  }, "Remove reaction failed:");
  return result ?? false;
}

// ============================================================================
// User Info
// ============================================================================

export interface UserInfo {
  open_id: string;
  name?: string;
  en_name?: string;
}

export async function getUserName(
  projectDir: string,
  openId: string
): Promise<UserInfo | null> {
  const result = await withLarkClient(projectDir, async (c) => {
    const res = await c.contact.user.get({
      path: {
        user_id: openId,
      },
      params: {
        user_id_type: 'open_id',
      },
    });
    
    if (res.code !== 0 || !res.data?.user) {
      return null;
    }
    
    return {
      open_id: res.data.user.open_id,
      name: res.data.user.name,
      en_name: res.data.user.en_name,
    };
  }, `Failed to get user info: ${openId}`);
  
  return result;
}

// ============================================================================
// WebSocket Management
// ============================================================================

export async function createWSClient(
  client: { appId: string; appSecret: string },
  options: {
    onMessage?: (msg: any) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    reconnectInterval?: number;
  } = {}
): Promise<FeishuWSClient | null> {
  const wsClient: FeishuWSClient = {
    onMessage: options.onMessage,
    onConnect: options.onConnect,
    onDisconnect: options.onDisconnect,
  };

  try {
    const lark = await import("@larksuiteoapi/node-sdk");

    const eventDispatcher = new lark.EventDispatcher({}).register({
      "im.message.receive_v1": async (data: any) => {
        if (wsClient.onMessage) wsClient.onMessage(data);
      },
    });

    const ws = new lark.WSClient({
      appId: client.appId,
      appSecret: client.appSecret,
      loggerLevel: lark.LoggerLevel.warn,
    });

    await ws.start({ eventDispatcher });

    if (wsClient.onConnect) {
      wsClient.onConnect();
    }

    wsClient.wsClient = ws;
    return wsClient;
  } catch (e) {
    logger.error('Feishu', "Failed to create WS client:", e);
    return null;
  }
}

export function closeWSClient(wsClient: FeishuWSClient): void {
  if (wsClient.wsClient) {
    wsClient.wsClient.close();
    wsClient.wsClient = undefined;
  }
}
