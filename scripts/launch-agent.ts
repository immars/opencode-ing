#!/usr/bin/env tsx
/**
 * OpenCode-ing Agent Launcher
 * 
 * 功能：
 * 1. 启动 OpenCode 服务器
 * 2. 创建会话
 * 3. 等待指定时间
 * 4. 发送触发消息给 agent
 */

import { createOpencode } from "@opencode-ai/sdk";

const TRIGGER_DELAY_MS = 10_000; // 10 秒延迟
const DEFAULT_MESSAGE = "你好，请介绍一下你自己和你的能力";
const TIMEOUT_MS = 120_000; // 2 分钟超时等待响应

async function main() {
  console.log("=== OpenCode-ing Agent Launcher ===\n");

  // Step 1: 启动 OpenCode 服务器
  console.log("1. Starting OpenCode server...");
  const opencode = await createOpencode({
    hostname: "127.0.0.1",
    port: 0,
  });
  const serverUrl = opencode.server.url;
  console.log(`   Server running at: ${serverUrl}`);

  const { client } = opencode;

  // Step 2: 列出可用 agents
  console.log("\n2. Available agents:");
  const agentsResp = await client.app.agents();
  const agents = agentsResp?.data || [];
  const assistant = agents.find((a: any) => a.name?.toLowerCase().includes("assistant"));
  console.log(`   Found ${agents.length} agents`);
  if (assistant) {
    console.log(`   ✓ Assistant: ${assistant.name} (${assistant.mode})`);
  } else {
    console.log("   ✗ Assistant agent not found!");
  }
  
  // Step 3: 创建会话
  console.log("\n3. Creating session...");
  const sessionResp = await client.session.create({
    body: {
      title: "OpenCode-ing Agent Session",
    },
  });
  
  const sessionId = sessionResp?.data?.id;
  console.log(`   Session ID: ${sessionId}`);

  // Step 4: 等待后触发
  console.log(`\n4. Waiting ${TRIGGER_DELAY_MS / 1000} seconds before trigger...`);
  await new Promise((resolve) => setTimeout(resolve, TRIGGER_DELAY_MS));

  // Step 5: 发送触发消息
  console.log("\n5. Sending trigger message...");
  console.log(`   Message: "${DEFAULT_MESSAGE}"`);
  
  try {
    // 设置更长的超时来等待响应
    const result = await Promise.race([
      client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: "text", text: DEFAULT_MESSAGE }],
        },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout waiting for response")), TIMEOUT_MS)
      )
    ]);

    console.log("\n=== Response received ===");
    const responseText = (result as any)?.data?.info?.parts?.[0]?.text;
    if (responseText) {
      console.log(responseText.slice(0, 500));
    } else {
      console.log(JSON.stringify(result, null, 2).slice(0, 1000));
    }
  } catch (e: any) {
    if (e.message?.includes("Timeout")) {
      console.log("   (Response timeout - message sent successfully)");
    } else {
      console.error("   Error:", e.message);
    }
  }

  console.log("\n[Session active. Press Ctrl+C to exit]");
  
  // 保持服务器运行
  process.on("SIGINT", () => {
    console.log("\n\nShutting down...");
    opencode.server.close();
    process.exit(0);
  });
  
  // 保持进程存活
  await new Promise(() => {}); // never resolves
}

main().catch(console.error);
