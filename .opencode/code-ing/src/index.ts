/**
 * code-ing Plugin
 *
 * OpenCode-ing Agent 插件
 * 功能：
 * 1. 查找或创建 "Assistant Managed Session"
 * 2. 飞书连接
 * 3. 记忆系统 Context 注入
 */

import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { buildMemoryContext, loadFeishuConfig, writeMessageRecord, recordContact, readContacts } from "./memory";
import { startSchedulerWithAgent } from "./scheduler.js";

import { createFeishuClient, createWSClient, closeWSClient, sendMessage, checkConnection, addReaction, removeReaction } from "./feishu.js";

const MANAGED_SESSION_NAME = "Assistant Managed Session";
const HEARTBEAT_INTERVAL = 30 * 60 * 1000; // 30 minutes

export const codeIng: Plugin = async (ctx): Promise<Hooks> => {
  const { client, directory } = ctx;
  console.error('[code-ing] directory:', directory);

  // 获取目录信息
  const memoryContext = buildMemoryContext(directory, "feishu_message");

  // 注入记忆的 system prompt
  const systemPromptWithMemory = `
你是 code-ing agent，有自己的记忆系统。

${memoryContext.directoryInfo}

## 记忆规则
1. 重要信息写入 .code-ing/workspace/long-term/
2. 每轮对话结束总结写入短期记忆
3. 定期将短期记忆合并到长期记忆
`.trim();

  // 飞书连接状态
  let feishuWSClient: any = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  // 启动心跳检测
  const startHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    heartbeatTimer = setInterval(async () => {
      const connected = await checkConnection(directory);
      if (!connected) {
        console.error("[Feishu] Connection lost, attempting to reconnect...");
        await connectFeishu();
      } else {
        console.error("[Feishu] Heartbeat: connection OK");
      }
    }, HEARTBEAT_INTERVAL);
  };

  // 启动定时任务调度器 (with agent execution)
  startSchedulerWithAgent(directory, client);

  // 连接飞书
  const connectFeishu = async (): Promise<string> => {
    const config = loadFeishuConfig(directory);

    if (!config) {
      return "未找到飞书配置";
    }

    if (!config.app_id || !config.app_secret) {
      return "飞书配置不完整，请填写 app_id 和 app_secret";
    }

    const feishuClient = createFeishuClient(directory);
    if (!feishuClient) {
      return "飞书客户端创建失败";
    }

    // 关闭旧连接
    if (feishuWSClient) {
      closeWSClient(feishuWSClient);
    }

    feishuWSClient = await createWSClient(feishuClient, {
      onMessage: async (msg: any) => {
        // 飞书消息结构是扁平的: msg.message.chat_id, msg.message.content
        const chatId = msg.message?.chat_id;
        const messageId = msg.message?.message_id;
        const rawContent = msg.message?.content || "";
        let textContent = rawContent;

        try {
          const parsed = JSON.parse(rawContent);
          textContent = parsed.text || rawContent;
        } catch (e) {
          // ignore JSON parse error
        }

        if (textContent && chatId) {
          // Record contact
          recordContact(directory, chatId, undefined, 'group');

          // Add reaction to indicate processing
          if (messageId) {
            await addReaction(directory, messageId);
          }

          const today = new Date().toISOString().split('T')[0];
          writeMessageRecord(directory, today, {
            timestamp: new Date().toISOString(),
            role: 'user',
            content: textContent,
            source: 'feishu',
          });

          // 1. 找到或创建 Managed Session
          const sessionId = await getOrCreateManagedSession();
          if (!sessionId) {
            return;
          }

          // 2. 将消息发给 assistant
          try {
            const result = await client.session.prompt({
              path: { id: sessionId },
              body: {
                parts: [{ type: "text", text: textContent }],
              },
            });

            // 3. 提取 assistant 回复
            const response = (result as any)?.data;
            const parts = response?.parts || [];

            // 从 parts 中提取 text 类型的内容
            const textParts = parts.filter((p: any) => p.type === "text");
            const responseText = textParts.map((p: any) => p.text).join("\n");

            if (responseText) {
              writeMessageRecord(directory, today, {
                timestamp: new Date().toISOString(),
                role: 'assistant',
                content: responseText,
                source: 'feishu',
              });
              const sendClient = createFeishuClient(directory);
              if (sendClient) {
                await sendMessage(sendClient, chatId, responseText);
              }
            } else {
              const sendClient = createFeishuClient(directory);
              if (sendClient) {
                await sendMessage(sendClient, chatId, "Assistant finished processing.");
              }
            }

            // Remove reaction after response
            if (messageId) {
              await removeReaction(directory, messageId);
            }
          } catch (err: any) {
            // Remove reaction on error
            if (messageId) {
              await removeReaction(directory, messageId);
            }
            console.error("Error processing feishu message:", err);
          }
        }
      },
      onConnect: async () => {
        // Connected
      },
      onDisconnect: async () => {
        // Disconnected
      },
    });

    if (!feishuWSClient) {
      return "飞书连接失败";
    }

    startHeartbeat();

    const contacts = readContacts(directory);
    console.error("[code-ing] Contacts found:", contacts.length);
    if (contacts.length > 0) {
      const sorted = contacts.sort((a, b) => 
        new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
      );
      const recentContact = sorted[0];
      console.error("[code-ing] Notifying recent contact:", recentContact.chatId);
      const feishuClient = createFeishuClient(directory);
      if (feishuClient) {
        const sent = await sendMessage(feishuClient, recentContact.chatId, "Assistant 启动成功！");
        console.error("[code-ing] Message sent:", sent);
      } else {
        console.error("[code-ing] No feishu client");
      }
    } else {
      console.error("[code-ing] No contacts to notify");
    }

    return "飞书已连接！\n- App ID: " + config.app_id + "\n- Connection: 长连接 (WebSocket)";
  };

  // 初始化时尝试连接飞书
  setTimeout(async () => {
    const config = loadFeishuConfig(directory);
    if (config && config.app_id && config.app_secret) {
      await connectFeishu();
    }
  }, 2000);

  // 查找或创建专属 session
  const getOrCreateManagedSession = async (): Promise<string | null> => {
    try {
      const sessionsResp = await client.session.list();
      const allSessions = sessionsResp?.data || [];

      const sessions = allSessions.filter((s: any) => s.title === MANAGED_SESSION_NAME);

      if (sessions.length > 0) {
        return sessions[0].id;
      }

      const newSession = await client.session.create({
        body: { title: MANAGED_SESSION_NAME },
      });

      const newSessionId = newSession.data?.id;
      if (newSessionId) {
        return newSessionId;
      }

      return null;
    } catch (err) {
      return null;
    }
  };

  // 返回 hooks，包含自定义工具
  return {
    tool: {
      // 重新加载飞书配置并连接
      "code-ing.reload-feishu": tool({
        description: "重新加载飞书配置并建立连接",
        args: {},
        async execute(args, context) {
          return await connectFeishu();
        },
      }),

      // 获取飞书配置状态
      "code-ing.feishu-status": tool({
        description: "获取当前飞书配置状态",
        args: {},
        async execute(args, context) {
          const config = loadFeishuConfig(directory);

          if (!config) {
            return "未找到飞书配置";
          }

          const groupIds = Array.isArray(config.message?.group_ids)
            ? config.message.group_ids.join(", ")
            : "全部";
          return "飞书配置状态:\n- App ID: " + (config.app_id || "未设置") + "\n- Connection: " + (config.connection?.enabled ? "长连接 (WebSocket)" : "未启用") + "\n- Group IDs: " + groupIds;
        },
      }),

      // 获取记忆状态
      "code-ing.memory-status": tool({
        description: "获取当前记忆状态",
        args: {},
        async execute(args, context) {
          const memCtx = buildMemoryContext(directory, "feishu_message");
          const contacts = readContacts(directory);
          const contactCount = contacts.length;
          return "记忆状态:\n- 长期记忆: " + (memCtx.longTermMemory ? "有内容" : "暂无") + "\n- 最近消息: " + memCtx.recentMessages.length + "条\n- 每日摘要: " + memCtx.dailySummaries.length + "条\n- 联系人/群: " + contactCount + "个\n- 目录: .code-ing/workspace/";
        },
      }),
    },
  };
};

export default codeIng;
