/**
 * code-ing Plugin
 * 
 * OpenCode-ing Agent 插件
 * 功能：
 * 1. 查找或创建 "Assistant Managed Session"
 * 2. 定时触发 assistant agent
 * 3. 注入记忆 Context
 * 4. 飞书连接
 */

import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { buildMemoryContext, loadFeishuConfig } from "./memory.js";
import { createFeishuClient, createWSClient, closeWSClient } from "./feishu.js";

const MANAGED_SESSION_NAME = "Assistant Managed Session";

export const codeIng: Plugin = async (ctx): Promise<Hooks> => {
  const { client, directory } = ctx;

  await client.app.log({
    body: {
      service: "code-ing",
      level: "info",
      message: "code-ing Plugin initialized",
    },
  });

  const AUTO_TRIGGER_DELAY_MS = 10000;
  const DEFAULT_MESSAGE = "你好，请介绍一下你自己";

  // 获取目录信息
  const memoryContext = buildMemoryContext(directory, "current");
  
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
    
    await client.app.log({
      body: {
        service: "code-ing",
        level: "info",
        message: "正在连接飞书 WebSocket...",
      },
    });
    
    feishuWSClient = await createWSClient(feishuClient, {
      onMessage: async (msg: any) => {
        const content = msg.event?.message?.body?.content || "";
        await client.app.log({
          body: {
            service: "code-ing",
            level: "info",
            message: "收到飞书消息: " + content.slice(0, 100),
          },
        });
      },
      onConnect: async () => {
        await client.app.log({
          body: {
            service: "code-ing",
            level: "info",
            message: "飞书 WebSocket 已连接！",
          },
        });
      },
      onDisconnect: async () => {
        await client.app.log({
          body: {
            service: "code-ing",
            level: "warn",
            message: "飞书 WebSocket 断开连接",
          },
        });
      },
    });
    
    if (!feishuWSClient) {
      return "飞书连接失败";
    }
    
    return "飞书已连接！\n- App ID: " + config.app_id + "\n- Connection: 长连接 (WebSocket)";
  };

  // 初始化时尝试连接飞书
  setTimeout(async () => {
    const config = loadFeishuConfig(directory);
    if (config && config.app_id && config.app_secret) {
      await client.app.log({
        body: {
          service: "code-ing",
          level: "info",
          message: "检测到飞书配置，尝试自动连接...",
        },
      });
      await connectFeishu();
    }
  }, 2000);

  // 查找或创建专属 session
  const getOrCreateManagedSession = async (): Promise<string | null> => {
    try {
      await client.app.log({
        body: {
          service: "code-ing",
          level: "info",
          message: "Searching for session: " + MANAGED_SESSION_NAME,
        },
      });

      const sessionsResp = await client.session.list();
      const allSessions = sessionsResp?.data || [];
      
      const sessions = allSessions.filter((s: any) => s.title === MANAGED_SESSION_NAME);

      if (sessions.length > 0) {
        const existingSession = sessions[0];
        await client.app.log({
          body: {
            service: "code-ing",
            level: "info",
            message: "Found existing managed session: " + existingSession.id,
          },
        });
        return existingSession.id;
      }

      await client.app.log({
        body: {
          service: "code-ing",
          level: "info",
          message: "Creating new managed session: " + MANAGED_SESSION_NAME,
        },
      });

      const newSession = await client.session.create({
        body: { title: MANAGED_SESSION_NAME },
      });

      const newSessionId = newSession.data?.id;
      if (newSessionId) {
        await client.app.log({
          body: {
            service: "code-ing",
            level: "info",
            message: "Created managed session: " + newSessionId,
          },
        });
        return newSessionId;
      }

      return null;
    } catch (err) {
      await client.app.log({
        body: {
          service: "code-ing",
          level: "error",
          message: "Failed to get/create managed session: " + err,
        },
      });
      return null;
    }
  };

  // 定时触发函数
  const scheduleTrigger = async (sessionId: string) => {
    await client.app.log({
      body: {
        service: "code-ing",
        level: "info",
        message: "Scheduling auto-trigger for session " + sessionId + " in " + AUTO_TRIGGER_DELAY_MS + "ms",
      },
    });

    setTimeout(async () => {
      try {
        await client.app.log({
          body: {
            service: "code-ing",
            level: "info",
            message: "Auto-trigger firing now...",
          },
        });

        const promptWithMemory = systemPromptWithMemory + "\n\n---\n\n## 长期记忆\n" + memoryContext.longTermMemory + "\n\n## 当前会话\n" + memoryContext.shortTermMemory + "\n\n---\n\n## 当前任务\n" + DEFAULT_MESSAGE;

        await client.session.prompt({
          path: { id: sessionId },
          body: {
            agent: "assistant",
            parts: [{ type: "text", text: promptWithMemory }],
          },
        });

        await client.app.log({
          body: {
            service: "code-ing",
            level: "info",
            message: "Auto-trigger sent with memory context",
          },
        });
      } catch (err) {
        await client.app.log({
          body: {
            service: "code-ing",
            level: "error",
            message: "Auto-trigger error: " + err,
          },
        });
      }
    }, AUTO_TRIGGER_DELAY_MS);
  };

  // 主流程
  const run = async () => {
    await client.app.log({
      body: {
        service: "code-ing",
        level: "info",
        message: "Memory directory: .code-ing/",
      },
    });

    const sessionId = await getOrCreateManagedSession();
    if (sessionId) {
      await scheduleTrigger(sessionId);
    }
  };

  setTimeout(run, 3000);

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
          const memCtx = buildMemoryContext(directory, "current");
          return "记忆状态:\n- 长期记忆: " + (memCtx.longTermMemory ? "有内容" : "暂无") + "\n- 短期记忆: " + (memCtx.shortTermMemory ? "有内容" : "暂无") + "\n- 目录: .code-ing/workspace/";
        },
      }),
    },
  };
};

export default codeIng;
