/**
 * code-ing Feishu Integration Module
 * 
 * 负责：
 * 1. 读取飞书配置
 * 2. 获取飞书 access_token
 * 3. 接收消息
 * 4. 发送消息
 */

import { loadFeishuConfig } from "./memory.js";

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

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
  // 检查缓存的 token 是否有效
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
      // 提前 5 分钟过期
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
 * 拉取消息列表（轮询）
 */
export async function pullMessages(
  client: FeishuClient,
  chatId: string,
  startTime?: string
): Promise<FeishuMessage[]> {
  const token = await getAccessToken(client);
  if (!token) {
    return [];
  }
  
  try {
    const params = new URLSearchParams({
      receive_id: chatId,
      receive_id_type: "chat_id",
    });
    
    if (startTime) {
      params.append("start_time", startTime);
    }
    
    const response = await fetch(
      `${FEISHU_API_BASE}/im/v1/messages?${params}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      }
    );
    
    const data = await response.json();
    
    if (data.code === 0 && data.data && data.data.items) {
      return data.data.items;
    }
    
    return [];
  } catch (e) {
    console.error("Error pulling messages:", e);
    return [];
  }
}

export default {
  createFeishuClient,
  getAccessToken,
  sendMessage,
  replyMessage,
  pullMessages,
};
