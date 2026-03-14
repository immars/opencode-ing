import { tool } from '@opencode-ai/plugin';
import { buildMemoryContext } from './memory.js';
import { loadFeishuConfig } from './config.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface ToolDeps {
  directory: string;
  connectFeishu: () => Promise<string>;
}

export function createTools(deps: ToolDeps): Record<string, ReturnType<typeof tool>> {
  const { directory, connectFeishu } = deps;

  return {
    'code-ing.reload-feishu': tool({
      description: '重新加载飞书配置并建立连接',
      args: {},
      async execute(args, context) {
        return await connectFeishu();
      },
    }),

    'code-ing.feishu-status': tool({
      description: '获取当前飞书配置状态',
      args: {},
      async execute(args, context) {
        const config = loadFeishuConfig(directory);

        if (!config) {
          return '未找到飞书配置';
        }

        const groupIds = Array.isArray(config.message?.group_ids)
          ? config.message.group_ids.join(', ')
          : '全部';
        return (
          '飞书配置状态:\n- App ID: ' +
          (config.app_id || '未设置') +
          '\n- Connection: ' +
          (config.connection?.enabled ? '长连接 (WebSocket)' : '未启用') +
          '\n- Group IDs: ' +
          groupIds
        );
      },
    }),

    'code-ing.memory-status': tool({
      description: '获取当前记忆状态',
      args: {},
      async execute(args, context) {
        const memCtx = buildMemoryContext(directory, 'feishu_message');
        return (
          '记忆状态:\n- 长期记忆: ' +
          (memCtx.longTermMemory ? '有内容' : '暂无') +
          '\n- 最近消息: ' +
          memCtx.recentMessages.length +
          '条\n- 每日摘要: ' +
          memCtx.dailySummaries.length +
          '条\n- 目录: .code-ing/workspace/'
        );
      },
    }),

    'code-ing.onboard': tool({
      description: '引导用户完成 OpenCode-ing agent 配置',
      args: {
        app_id: tool.schema.string().optional(),
        app_secret: tool.schema.string().optional(),
      },
      async execute(args, context) {
        const codeIngDir = path.join(directory, '.code-ing');
        const configDir = path.join(codeIngDir, 'config');
        const memoryRootDir = path.join(codeIngDir, 'memory');

        // 创建目录结构
        await fs.mkdir(configDir, { recursive: true });
        await fs.mkdir(path.join(memoryRootDir, 'L0'), { recursive: true });
        await fs.mkdir(path.join(memoryRootDir, 'L1'), { recursive: true });
        await fs.mkdir(path.join(memoryRootDir, 'L2'), { recursive: true });

        const results: string[] = [];
        results.push(`✓ 创建目录结构: ${codeIngDir}`);

        // 处理 feishu.yaml
        const feishuConfigPath = path.join(configDir, 'feishu.yaml');
        const feishuTemplatePath = path.join(process.cwd(), 'templates/config/feishu.yaml');

        try {
          await fs.access(feishuConfigPath);
          // 文件已存在，检查是否需要更新 app_id/app_secret
          if (args.app_id && args.app_secret) {
            let configContent = await fs.readFile(feishuConfigPath, 'utf-8');
            configContent = configContent.replace(/app_id:\s*['"][^'"]*['"]/, `app_id: '${args.app_id}'`);
            configContent = configContent.replace(/app_secret:\s*['"][^'"]*['"]/, `app_secret: '${args.app_secret}'`);
            await fs.writeFile(feishuConfigPath, configContent, 'utf-8');
            results.push('✓ 已更新飞书配置 (app_id, app_secret)');
          } else {
            results.push('✓ 飞书配置文件已存在');
          }
        } catch {
          // 文件不存在，从模板拷贝
          try {
            const templateContent = await fs.readFile(feishuTemplatePath, 'utf-8');
            if (args.app_id && args.app_secret) {
              let configContent = templateContent.replace(/app_id:\s*['"]your_app_id['"]/, `app_id: '${args.app_id}'`);
              configContent = configContent.replace(/app_secret:\s*['"]your_secret['"]/, `app_secret: '${args.app_secret}'`);
              await fs.writeFile(feishuConfigPath, configContent, 'utf-8');
              results.push('✓ 已创建飞书配置文件 (含凭证)');
            } else {
              await fs.writeFile(feishuConfigPath, templateContent, 'utf-8');
              results.push('✓ 已创建飞书配置文件 (请提供 app_id 和 app_secret)');
              results.push('');
              results.push('请提供飞书凭证：');
              results.push('1. 访问 https://open.feishu.cn/ 创建企业自建应用');
              results.push('2. 添加"机器人"能力');
              results.push('3. 获取 App ID 和 App Secret');
              results.push('4. 在"事件订阅"中启用长连接接收消息');
              results.push('');
              results.push('请运行: /code-ing.onboard app_id="你的AppID" app_secret="你的AppSecret"');
            }
          } catch (e) {
            results.push(`✗ 飞书模板文件不存在: ${feishuTemplatePath}`);
          }
        }

        // 处理 memory 模板文件
        const templateMemoryDir = path.join(process.cwd(), 'templates/memory');
        const memoryFiles = ['SOUL.md', 'PEOPLE.md', 'CRON_SYS.md'];

        for (const file of memoryFiles) {
          const destPath = path.join(memoryRootDir, file);
          try {
            await fs.access(destPath);
            results.push(`✓ ${file} 已存在`);
          } catch {
            try {
              const srcPath = path.join(templateMemoryDir, file);
              const content = await fs.readFile(srcPath, 'utf-8');
              await fs.writeFile(destPath, content, 'utf-8');
              results.push(`✓ 已创建 ${file}`);
            } catch (e) {
              results.push(`✗ 模板文件不存在: ${file}`);
            }
          }
        }

        // 创建 TASK.md 和 CRON.md (如果不存在)
        const taskFile = path.join(memoryRootDir, 'TASK.md');
        const cronFile = path.join(memoryRootDir, 'CRON.md');

        for (const [file, content] of [[taskFile, '# 任务表\n\n'], [cronFile, '# 定时任务\n\n']]) {
          try {
            await fs.access(file);
          } catch {
            await fs.writeFile(file, content, 'utf-8');
            results.push(`✓ 已创建 ${path.basename(file)}`);
          }
        }

        results.push('');
        if (args.app_id && args.app_secret) {
          results.push('配置成功，请重启 opencode 以生效');
        } else {
          results.push('请提供飞书凭证后重新运行 onboard');
        }

        return results.join('\n');
      },
    }),
  };
}
