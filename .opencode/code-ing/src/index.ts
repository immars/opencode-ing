/**
 * code-ing Plugin
 * 
 * OpenCode-ing Agent 插件
 * 功能：
 * 1. 查找或创建 "Assistant Managed Session"
 * 2. 定时触发 assistant agent
 */

import type { Plugin, Hooks } from "@opencode-ai/plugin";

const MANAGED_SESSION_NAME = "Assistant Managed Session";

export const codeIng: Plugin = async (ctx): Promise<Hooks> => {
  const { client } = ctx;

  await client.app.log({
    body: {
      service: "code-ing",
      level: "info",
      message: "code-ing Plugin initialized",
    },
  });

  const AUTO_TRIGGER_DELAY_MS = 10000;
  const DEFAULT_MESSAGE = "你好，请介绍一下你自己";

  // 查找或创建专属 session
  const getOrCreateManagedSession = async (): Promise<string | null> => {
    try {
      // 搜索名为 "Assistant Managed Session" 的 session
      await client.app.log({
        body: {
          service: "code-ing",
          level: "info",
          message: `Searching for session: "${MANAGED_SESSION_NAME}"`,
        },
      });

      // 获取所有 session（当前 SDK 不支持 search 参数，需要手动过滤）
      const sessionsResp = await client.session.list();
      const allSessions = sessionsResp?.data || [];
      
      // 手动过滤出名为 "Assistant Managed Session" 的 session
      const sessions = allSessions.filter((s: any) => s.title === MANAGED_SESSION_NAME);

      if (sessions.length > 0) {
        // 找到已存在的 session
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

      // 没找到，创建新的 session
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

        // 发送消息到 assistant agent
        await client.session.prompt({
          path: { id: sessionId },
          body: {
            agent: "assistant",
            parts: [{ type: "text", text: DEFAULT_MESSAGE }],
          },
        });

        await client.app.log({
          body: {
            service: "code-ing",
            level: "info",
            message: `Auto-trigger sent to assistant: "${DEFAULT_MESSAGE}"`,
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
    const sessionId = await getOrCreateManagedSession();
    if (sessionId) {
      await scheduleTrigger(sessionId);
    }
  };

  // 延迟后执行
  setTimeout(run, 3000);

  return {};
};

export default codeIng;
