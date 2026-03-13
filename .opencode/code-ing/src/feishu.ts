/**
 * code-ing Feishu Integration Module
 */

import { loadFeishuConfig } from "./config.js";

export interface FeishuWSClient {
  wsClient?: any;
  onMessage?: (event: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

// 表情类型映射
const REACTION_EMOJI = "SMILE";

export function createFeishuClient(projectDir: string): { appId: string; appSecret: string } | null {
  const config = loadFeishuConfig(projectDir);
  if (!config || !config.app_id || !config.app_secret) {
    return null;
  }
  return { appId: config.app_id, appSecret: config.app_secret };
}

let cachedClient: { appId: string; appSecret: string } | null = null;
let cachedProjectDir: string | null = null;

function getOrCreateClient(projectDir: string): { appId: string; appSecret: string } | null {
  if (cachedProjectDir === projectDir && cachedClient) {
    return cachedClient;
  }
  const client = createFeishuClient(projectDir);
  if (client) {
    cachedClient = client;
    cachedProjectDir = projectDir;
  }
  return client;
}

async function withLarkClient<T>(
  projectDir: string,
  operation: (c: any) => Promise<T>,
  errorMsg?: string
): Promise<T | null> {
  const client = getOrCreateClient(projectDir);
  if (!client) return null;
  try {
    const lark = await import("@larksuiteoapi/node-sdk");
    const c = new lark.Client({ appId: client.appId, appSecret: client.appSecret });
    return await operation(c);
  } catch (e) {
    console.error(errorMsg || "[Feishu] Operation failed:", e);
    return null;
  }
}

export interface RichTextContent {
  zh_cn: {
    title: string;
    content: Array<Array<{ tag: string; text?: string; href?: string; style?: string[] }>>;
  };
}

export async function sendMessage(
  client: { appId: string; appSecret: string },
  chatId: string,
  content: string,
  richContent?: RichTextContent
): Promise<boolean> {
  try {
    const lark = await import("@larksuiteoapi/node-sdk");
    const c = new lark.Client({ appId: client.appId, appSecret: client.appSecret });
    
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
  } catch (e) {
    console.error("Error sending message:", e);
    return false;
  }
}

export async function checkConnection(projectDir: string): Promise<boolean> {
  const result = await withLarkClient(projectDir, async (c) => {
    const result = await c.contact.user.get({ path: { user_id: "me" } });
    return result.code === 0;
  }, "[Feishu] Connection check failed:");
  return result ?? false;
}

export async function addReaction(
  projectDir: string,
  messageId: string
): Promise<boolean> {
  console.error(`[Feishu] addReaction called for message: ${messageId}`);
  const result = await withLarkClient(projectDir, async (c) => {
    const result = await c.im.messageReaction.create({
      path: { message_id: messageId },
      data: { reaction_type: { emoji_type: REACTION_EMOJI } },
    });
    console.error(`[Feishu] addReaction API result: code=${result.code}, data=`, JSON.stringify(result.data));
    return result.code === 0;
  }, "[Feishu] Add reaction failed:");
  console.error(`[Feishu] addReaction final result: ${result}`);
  return result ?? false;
}

export async function removeReaction(
  projectDir: string,
  messageId: string
): Promise<boolean> {
  console.error(`[Feishu] removeReaction called for message: ${messageId}`);
  const result = await withLarkClient(projectDir, async (c) => {
    const listResult = await c.im.messageReaction.list({
      path: { message_id: messageId },
    });
    console.error(`[Feishu] removeReaction list result: code=${listResult.code}, items=${listResult.data?.items?.length || 0}`);
    if (listResult.code !== 0 || !listResult.data?.items) {
      return false;
    }
    const ourReaction = listResult.data.items.find(
      (r: any) => r.reaction_type?.emoji_type === REACTION_EMOJI
    );
    console.error(`[Feishu] Found our reaction:`, ourReaction ? JSON.stringify(ourReaction) : 'none');
    if (!ourReaction || !ourReaction.reaction_id) {
      return true;
    }
    const deleteResult = await c.im.messageReaction.delete({
      path: { message_id: messageId, reaction_id: ourReaction.reaction_id },
    });
    console.error(`[Feishu] removeReaction delete result: code=${deleteResult.code}`);
    return deleteResult.code === 0;
  }, "[Feishu] Remove reaction failed:");
  console.error(`[Feishu] removeReaction final result: ${result}`);
  return result ?? false;
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

    // 创建事件分发器
    const eventDispatcher = new lark.EventDispatcher({}).register({
      "im.message.receive_v1": async (data: any) => {
        console.error("[code-ing] [Feishu WS] Received:", data);
        if (wsClient.onMessage) wsClient.onMessage(data);
      },
    });

    // 创建 WS Client
    const ws = new lark.WSClient({
      appId: client.appId,
      appSecret: client.appSecret,
      loggerLevel: lark.LoggerLevel.warn,
    });

    // 启动长连接
    ws.start({ eventDispatcher });

    console.error("[code-ing] [Feishu WS] Started, waiting for connection...");

    // 延迟触发 onConnect 回调（WebSocket 需要时间建立连接）
    setTimeout(() => {
      console.error("[code-ing] [Feishu WS] Connection established");
      if (wsClient.onConnect) wsClient.onConnect();
    }, 1000);

    wsClient.wsClient = ws;
    return wsClient;
  } catch (e) {
    console.error("[Feishu WS] Failed to create:", e);
    return null;
  }
}

export function closeWSClient(wsClient: FeishuWSClient): void {
  if (wsClient.wsClient) {
    wsClient.wsClient.close();
    wsClient.wsClient = undefined;
  }
}

export default { createFeishuClient, sendMessage, createWSClient, closeWSClient, checkConnection, addReaction, removeReaction };
