import type { Plugin, Hooks } from '@opencode-ai/plugin';
import { buildMemoryContext, loadFeishuConfig, startScheduler, generateDailySummary, generateWeeklySummary } from './memory.js';
import { createFeishuClient, createWSClient, closeWSClient } from './feishu.js';
import { handleFeishuMessage } from './agent/message-handler.js';
import { createTools } from './tools.js';

export const codeIng: Plugin = async (ctx): Promise<Hooks> => {
  const { client, directory } = ctx;

  const memoryContext = buildMemoryContext(directory, 'feishu_message');

  const systemPromptWithMemory = `
你是 code-ing agent，有自己的记忆系统。

${memoryContext.directoryInfo}

## 记忆规则
1. 重要信息写入 .code-ing/workspace/long-term/
2. 每轮对话结束总结写入短期记忆
3. 定期将短期记忆合并到长期记忆
`.trim();

  let feishuWSClient: any = null;

  startScheduler(directory, async (tasks) => {
    for (const task of tasks) {
      if (task.name === 'generate-l1' || task.name === 'daily-summary') {
        const today = new Date().toISOString().split('T')[0];
        await generateDailySummary(directory, today);
      } else if (task.name === 'generate-l2' || task.name === 'weekly-summary') {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        await generateWeeklySummary(directory, weekStart.toISOString().split('T')[0]);
      }
    }
  });

  const connectFeishu = async (): Promise<string> => {
    const config = loadFeishuConfig(directory);

    if (!config) {
      return '未找到飞书配置';
    }

    if (!config.app_id || !config.app_secret) {
      return '飞书配置不完整，请填写 app_id 和 app_secret';
    }

    const feishuClient = createFeishuClient(directory);
    if (!feishuClient) {
      return '飞书客户端创建失败';
    }

    if (feishuWSClient) {
      closeWSClient(feishuWSClient);
    }

    feishuWSClient = await createWSClient(feishuClient, {
      onMessage: async (msg: any) => {
        await handleFeishuMessage({ client, directory }, msg);
      },
      onConnect: async () => {},
      onDisconnect: async () => {},
    });

    if (!feishuWSClient) {
      return '飞书连接失败';
    }

    return (
      '飞书已连接！\n- App ID: ' +
      config.app_id +
      '\n- Connection: 长连接 (WebSocket)'
    );
  };

  setTimeout(async () => {
    const config = loadFeishuConfig(directory);
    if (config && config.app_id && config.app_secret) {
      await connectFeishu();
    }
  }, 2000);

  const tools = createTools({ directory, connectFeishu });

  return {
    tool: tools,
  };
};

export default codeIng;
