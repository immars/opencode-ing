/**
 * code-ing Feishu Integration Module
 */

import { loadFeishuConfig } from "./memory.js";

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

export async function sendMessage(
  client: { appId: string; appSecret: string },
  chatId: string,
  content: string
): Promise<boolean> {
  try {
    const lark = await import("@larksuiteoapi/node-sdk");
    const c = new lark.Client({ appId: client.appId, appSecret: client.appSecret });
    const result = await c.im.message.create({
      params: { receive_id_type: "chat_id" },
      data: { receive_id: chatId, msg_type: "text", content: JSON.stringify({ text: content }) },
    });
    return result.code === 0;
  } catch (e) {
    console.error("Error sending message:", e);
    return false;
  }
}

export async function checkConnection(projectDir: string): Promise<boolean> {
  const client = getOrCreateClient(projectDir);
  if (!client) return false;
  try {
    const lark = await import("@larksuiteoapi/node-sdk");
    const c = new lark.Client({ appId: client.appId, appSecret: client.appSecret });
    const result = await c.contact.user.get({ path: { user_id: "me" } });
    return result.code === 0;
  } catch (e) {
    console.error("[Feishu] Connection check failed:", e);
    return false;
  }
}

export async function addReaction(
  projectDir: string,
  messageId: string
): Promise<boolean> {
  const client = getOrCreateClient(projectDir);
  if (!client) return false;
  try {
    const lark = await import("@larksuiteoapi/node-sdk");
    const c = new lark.Client({ appId: client.appId, appSecret: client.appSecret });
    const result = await c.im.messageReaction.create({
      path: { message_id: messageId },
      data: { reaction_type: { emoji_type: REACTION_EMOJI } },
    });
    return result.code === 0;
  } catch (e) {
    console.error("[Feishu] Add reaction failed:", e);
    return false;
  }
}

export async function removeReaction(
  projectDir: string,
  messageId: string
): Promise<boolean> {
  const client = getOrCreateClient(projectDir);
  if (!client) return false;
  try {
    const lark = await import("@larksuiteoapi/node-sdk");
    const c = new lark.Client({ appId: client.appId, appSecret: client.appSecret });
    // First, get the list of reactions to find the one to delete
    const listResult = await c.im.messageReaction.list({
      path: { message_id: messageId },
    });
    if (listResult.code !== 0 || !listResult.data?.items) {
      return false;
    }
    // Find our reaction
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
  } catch (e) {
    console.error("[Feishu] Remove reaction failed:", e);
    return false;
  }
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
    });

    // 启动长连接
    ws.start({ eventDispatcher });

    console.error("[code-ing] [Feishu WS] Started, waiting for connection...");

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
