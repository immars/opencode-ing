/**
 * code-ing Feishu Integration Module
 * 
 * 使用飞书官方 SDK 长连接
 * 参考: https://open.feishu.cn/document/ukTMukTMukTM/uADOwUjLwgDM14CM4ATN
 */

import { loadFeishuConfig } from "./memory.js";

// 动态导入 SDK
let Lark: any = null;
let WSClient: any = null;

async function getLarkSDK() {
  if (!Lark) {
    const module = await import("@larksuiteoapi/node-sdk");
    Lark = module.default;
    WSClient = module.WSClient;
  }
  return { Lark, WSClient };
}

export interface FeishuMessage {
  message_id: string;
  chat_id: string;
  sender: {
    id: string;
    name: string;
  };
  content: string;
  create_time: string;
}

export interface FeishuClient {
  app_id: string;
  app_secret: string;
  access_token?: string;
  token_expires_at?: number;
}

export interface FeishuWSClient {
  wsClient?: any;
  onMessage?: (event: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * 创建飞书客户端配置
 */
export function createFeishuClient(projectDir: string): { app_id: string; app_secret: string } | null {
  const config = loadFeishuConfig(projectDir);
  
  if (!config || !config.app_id || !config.app_secret) {
    return null;
  }
  
  return {
    app_id: config.app_id,
    app_secret: config.app_secret,
  };
}

/**
 * 获取 access_token
 */
export async function getAccessToken(client: { app_id: string; app_secret: string }): Promise<string | null> {
  const { Lark } = await getLarkSDK();
  
  const clientInstance = new Lark({
    appId: client.app_id,
    appSecret: client.app_secret,
  });
  
  try {
    const result = await clientInstance.auth.getTenantAccessToken({
      app_id: client.app_id,
      app_secret: client.app_secret,
    });
    
    if (result.code === 0) {
      return result.tenant_access_token;
    }
    
    console.error("Failed to get access_token:", result);
    return null;
  } catch (e) {
    console.error("Error getting access_token:", e);
    return null;
  }
}

/**
 * 发送消息
 */
export async function sendMessage(
  client: { app_id: string; app_secret: string },
  chatId: string,
  content: string
): Promise<boolean> {
  const { Lark } = await getLarkSDK();
  
  const clientInstance = new Lark({
    appId: client.app_id,
    appSecret: client.app_secret,
  });
  
  try {
    const result = await clientInstance.im.message.create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: chatId,
        msg_type: "text",
        content: JSON.stringify({ text: content }),
      },
    });
    
    return result.code === 0;
  } catch (e) {
    console.error("Error sending message:", e);
    return false;
  }
}

/**
 * 回复消息
 */
export async function replyMessage(
  client: { app_id: string; app_secret: string },
  messageId: string,
  content: string
): Promise<boolean> {
  const { Lark } = await getLarkSDK();
  
  const clientInstance = new Lark({
    appId: client.app_id,
    appSecret: client.app_secret,
  });
  
  try {
    const result = await clientInstance.im.message.reply({
      path: {
        message_id: messageId,
      },
      data: {
        msg_type: "text",
        content: JSON.stringify({ text: content }),
      },
    });
    
    return result.code === 0;
  } catch (e) {
    console.error("Error replying message:", e);
    return false;
  }
}

/**
 * 创建长连接 WebSocket 客户端 (使用飞书 SDK)
 */
export async function createWSClient(
  client: { app_id: string; app_secret: string },
  options: {
    onMessage?: (msg: any) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    reconnectInterval?: number;
  } = {}
): Promise<FeishuWSClient | null> {
  const { Lark, WSClient: WSClientClass } = await getLarkSDK();
  
  const wsClient: FeishuWSClient = {
    onMessage: options.onMessage,
    onConnect: options.onConnect,
    onDisconnect: options.onDisconnect,
  };
  
  const clientInstance = new Lark({
    appId: client.app_id,
    appSecret: client.app_secret,
  });
  
  return new Promise((resolve) => {
    const ws = new WSClientClass(clientInstance, {
      onOpen: () => {
        console.log("[Feishu WS] Connected via SDK");
        if (wsClient.onConnect) {
          wsClient.onConnect();
        }
        resolve(wsClient);
      },
      onMessage: (msg: any) => {
        if (wsClient.onMessage) {
          wsClient.onMessage(msg);
        }
      },
      onClose: () => {
        console.log("[Feishu WS] Disconnected");
        if (wsClient.onDisconnect) {
          wsClient.onDisconnect();
        }
        
        setTimeout(async () => {
          console.log("[Feishu WS] Reconnecting...");
          await createWSClient(client, options);
        }, options.reconnectInterval || 5000);
      },
      onError: (error: any) => {
        console.error("[Feishu WS] Error:", error);
      },
    });
    
    wsClient.wsClient = ws;
  });
}

/**
 * 关闭 WebSocket 连接
 */
export function closeWSClient(wsClient: FeishuWSClient): void {
  if (wsClient.wsClient) {
    wsClient.wsClient.close();
    wsClient.wsClient = undefined;
  }
}

export default {
  createFeishuClient,
  getAccessToken,
  sendMessage,
  replyMessage,
  createWSClient,
  closeWSClient,
};
