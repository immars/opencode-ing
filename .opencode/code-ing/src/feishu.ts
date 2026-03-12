/**
 * code-ing Feishu Integration Module
 * 
 * 使用长连接 (WebSocket) 接收飞书事件
 * 参考: https://open.feishu.cn/document/ukTMukTMukTM/uADOwUjLwgDM14CM4ATN
 */

import { loadFeishuConfig } from "./memory.js";

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";
const WSS_URL = "wss://open.feishu.cn/websocket/v1";

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
  ws?: any;
  reconnectInterval?: number;
  onMessage?: (event: FeishuWSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface FeishuWSMessage {
  header: {
    event_id: string;
    event_type: string;
    token: string;
    create_time: string;
  };
  event: {
    message?: {
      message_id: string;
      chat_id: string;
      message_type: string;
      body?: {
        content: string;
      };
      sender?: {
        sender_id?: {
          user_id?: string;
        };
      };
    };
  };
}

/**
 * 创建飞书客户端
 */
export function createFeishuClient(projectDir: string): FeishuClient | null {
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
export async function getAccessToken(client: FeishuClient): Promise<string | null> {
  if (client.access_token && client.token_expires_at && Date.now() < client.token_expires_at) {
    return client.access_token;
  }
  
  try {
    const response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        app_id: client.app_id,
        app_secret: client.app_secret,
      }),
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      const token = data.tenant_access_token as string;
      client.access_token = token;
      client.token_expires_at = Date.now() + (data.expire - 300) * 1000;
      return token;
    }
    
    console.error("Failed to get access_token:", data);
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
  client: FeishuClient,
  chatId: string,
  content: string
): Promise<boolean> {
  const token = await getAccessToken(client);
  if (!token) {
    return false;
  }
  
  try {
    const response = await fetch(`${FEISHU_API_BASE}/im/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: chatId,
        receive_id_type: "chat_id",
        msg_type: "text",
        content: JSON.stringify({ text: content }),
      }),
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      return true;
    }
    
    console.error("Failed to send message:", data);
    return false;
  } catch (e) {
    console.error("Error sending message:", e);
    return false;
  }
}

/**
 * 回复消息
 */
export async function replyMessage(
  client: FeishuClient,
  messageId: string,
  content: string
): Promise<boolean> {
  const token = await getAccessToken(client);
  if (!token) {
    return false;
  }
  
  try {
    const response = await fetch(
      `${FEISHU_API_BASE}/im/v1/messages/${messageId}/reply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          msg_type: "text",
          content: JSON.stringify({ text: content }),
        }),
      }
    );
    
    const data = await response.json();
    
    if (data.code === 0) {
      return true;
    }
    
    console.error("Failed to reply message:", data);
    return false;
  } catch (e) {
    console.error("Error replying message:", e);
    return false;
  }
}

/**
 * 创建长连接 WebSocket 客户端
 */
export async function createWSClient(
  client: FeishuClient,
  options: {
    onMessage?: (msg: FeishuWSMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    reconnectInterval?: number;
  } = {}
): Promise<FeishuWSClient | null> {
  const token = await getAccessToken(client);
  if (!token) {
    console.error("Failed to get token for WS connection");
    return null;
  }

  const wsClient: FeishuWSClient = {
    reconnectInterval: options.reconnectInterval || 5000,
    onMessage: options.onMessage,
    onConnect: options.onConnect,
    onDisconnect: options.onDisconnect,
  };

  return new Promise((resolve) => {
    const wsUrl = `${WSS_URL}?app_id=${client.app_id}&app_secret=${client.app_secret}&tenant_access_token=${token}`;
    
    const ws = new (globalThis as any).WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("[Feishu WS] Connected");
      wsClient.ws = ws;
      if (wsClient.onConnect) {
        wsClient.onConnect();
      }
      resolve(wsClient);
    };
    
    ws.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        
        if (data.header?.event_type === "im.message" && wsClient.onMessage) {
          wsClient.onMessage(data as FeishuWSMessage);
        }
      } catch (e) {
        console.error("[Feishu WS] Parse error:", e);
      }
    };
    
    ws.onclose = () => {
      console.log("[Feishu WS] Disconnected");
      if (wsClient.onDisconnect) {
        wsClient.onDisconnect();
      }
      
      setTimeout(async () => {
        console.log("[Feishu WS] Reconnecting...");
        await createWSClient(client, options);
      }, wsClient.reconnectInterval);
    };
    
    ws.onerror = (error: any) => {
      console.error("[Feishu WS] Error:", error);
    };
  });
}

/**
 * 关闭 WebSocket 连接
 */
export function closeWSClient(wsClient: FeishuWSClient): void {
  if (wsClient.ws) {
    wsClient.ws.close();
    wsClient.ws = undefined;
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
