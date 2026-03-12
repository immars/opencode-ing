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

export function createFeishuClient(projectDir: string): { appId: string; appSecret: string } | null {
  const config = loadFeishuConfig(projectDir);
  if (!config || !config.app_id || !config.app_secret) {
    return null;
  }
  return { appId: config.app_id, appSecret: config.app_secret };
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

export default { createFeishuClient, sendMessage, createWSClient, closeWSClient };
