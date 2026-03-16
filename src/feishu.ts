import fs from 'node:fs/promises';
import path from 'node:path';
import { loadFeishuConfig } from "./config.js";
import { logger } from "./logger.js";
import {
  getCachedClient,
  setCachedClient,
  getCachedProjectDir,
  setCachedProjectDir,
  getLarkClientFromCache,
  setLarkClientToCache,
  clearLarkClientCache,
} from "./state.js";

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

const REACTION_EMOJI = "SMILE";

export function createFeishuClient(projectDir: string): { appId: string; appSecret: string } | null {
  const config = loadFeishuConfig(projectDir);
  if (!config || !config.app_id || !config.app_secret) {
    return null;
  }
  return { appId: config.app_id, appSecret: config.app_secret };
}

function getOrCreateClient(projectDir: string): { appId: string; appSecret: string } | null {
  if (getCachedProjectDir() === projectDir && getCachedClient()) {
    return getCachedClient();
  }
  const client = createFeishuClient(projectDir);
  if (client) {
    setCachedClient(client);
    setCachedProjectDir(projectDir);
    clearLarkClientCache();
  }
  return client;
}

async function getOrCreateLarkClient(client: { appId: string; appSecret: string }): Promise<any | null> {
  const cached = getLarkClientFromCache(client.appId);
  if (cached) {
    return cached;
  }
  
  try {
    const lark = await import("@larksuiteoapi/node-sdk");
    const c = new lark.Client({ appId: client.appId, appSecret: client.appSecret });
    setLarkClientToCache(client.appId, c);
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

import type { FeishuCard } from "./prettifier.js";

export interface RichTextContent {
  zh_cn: {
    title: string;
    content: Array<Array<{ tag: string; text?: string; href?: string; style?: string[] }>>;
  };
}

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
