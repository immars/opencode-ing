/**
 * code-ing Plugin
 * 
 * OpenCode-ing Agent 插件
 * 功能：
 * 1. 查找或创建 "Assistant Managed Session"
 * 2. 定时触发 assistant agent
 * 3. 注入记忆 Context
 */

import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { buildMemoryContext, loadFeishuConfig } from "./memory.js";


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

  // 查找或创建专属 session
  const getOrCreateManagedSession = async (): Promise<string | null> => {
    try {
      await client.app.log({
        body: {
          service: "code-ing",
          level: "info",
          message: `Searching for session: "${MANAGED_SESSION_NAME}"`,
        },
      });

      // 获取所有 session
      const sessionsResp = await client.session.list();
      const allSessions = sessionsResp?.data || [];
      
      // 手动过滤
      const sessions = allSessions.filter((s: any) => s.title === MANAGED_SESSION_NAME);

      if (sessions.length > 0) {
        const existingSession = sessions[0];
        await client.app.log({
          body: {
            service: "code-ing",
            level: "info",
            message: `Found existing managed session: ${existingSession.id}`,
          },
        });
        return existingSession.id;
      }

      // 创建新 session
      await client.app.log({
        body: {
          service: "code-ing",
          level: "info",
          message: `Creating new managed session: "${MANAGED_SESSION_NAME}"`,
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
            message: `Created managed session: ${newSessionId}`,
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
          message: `Failed to get/create managed session: ${err}`,
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
        message: `Scheduling auto-trigger for session ${sessionId} in ${AUTO_TRIGGER_DELAY_MS}ms`,
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

        // 构建带记忆的 prompt
        const promptWithMemory = `
${systemPromptWithMemory}

---

## 长期记忆
${memoryContext.longTermMemory}

## 当前会话
${memoryContext.shortTermMemory}

---

## 当前任务
${DEFAULT_MESSAGE}
`.trim();

        // 发送消息到 assistant agent（使用 system prompt）
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
            message: `Auto-trigger sent with memory context`,
          },
        });
      } catch (err) {
        await client.app.log({
          body: {
            service: "code-ing",
            level: "error",
            message: `Auto-trigger error: ${err}`,
          },
        });
      }
    }, AUTO_TRIGGER_DELAY_MS);
  };

  // 主流程
  const run = async () => {
    // 记录记忆目录信息
    await client.app.log({
      body: {
        service: "code-ing",
        level: "info",
        message: `Memory directory: ${memoryContext.directoryInfo.split('\n')[2]}`,
      },
    });

    const sessionId = await getOrCreateManagedSession();
    if (sessionId) {
      await scheduleTrigger(sessionId);
    }
  };

  // 延迟后执行
  setTimeout(run, 3000);

  // 返回 hooks，包含自定义工具
  return {
    tool: {
      // 重新加载飞书配置
      "code-ing.reload-feishu": tool({
        description: "重新加载飞书配置，当 feishu.yaml 被修改后调用",
        args: {},
        async execute(args, context) {
          const config = loadFeishuConfig(directory);
          
          if (!config) {
            return "未找到飞书配置，请先创建 .code-ing/config/feishu.yaml";
          }
          
          if (!config.app_id || !config.app_secret) {
            return "飞书配置不完整，请填写 app_id 和 app_secret";
          }
          
          await client.app.log({
            body: {
              service: "code-ing",
              level: "info",
              message: `飞书配置已重新加载: app_id=${config.app_id}`,
            },
          });
          
          return `飞书配置已重新加载！\n- App ID: ${config.app_id}\n- Connection: ${config.connection?.enabled ? '长连接' : 'Webhook'}`;
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
          
          return `飞书配置状态:\n- App ID: ${config.app_id || '未设置'}\n- Connection: ${config.connection?.enabled ? '长连接 (WebSocket)' : 'Webhook'}\n- Group IDs: ${config.message?.group_ids?.join(', ') || '全部'}`;
        },
      }),
      
      // 获取记忆状态
      "code-ing.memory-status": tool({
        description: "获取当前记忆状态",
        args: {},
        async execute(args, context) {
          const memCtx = buildMemoryContext(directory, "current");
          return `记忆状态:\n- 长期记忆: ${memCtx.longTermMemory ? '有内容' : '暂无'}\n- 短期记忆: ${memCtx.shortTermMemory ? '有内容' : '暂无'}\n- 目录: .code-ing/workspace/`;
        },
      }),
    },
  };
};

export default codeIng;
