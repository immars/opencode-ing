#!/usr/bin/env tsx
/**
 * Connect to current OpenCode session
 * 
 * 1. Connect to existing OpenCode server
 * 2. Find current session
 * 3. Switch to assistant agent
 * 4. Ask: "What is your name?"
 */

import { createOpencodeClient } from "@opencode-ai/sdk";

const CURRENT_SESSION_ID = "ses_3240c1035ffe72PZctFM55lc6g";

async function main() {
  console.log("=== Connect to Current OpenCode Session ===\n");

  // Try to connect to OpenCode server
  const ports = [4096, 4097, 4098, 4099, 4100];
  let client = null;
  let connectedPort = null;

  for (const port of ports) {
    try {
      console.log(`Trying port ${port}...`);
      client = createOpencodeClient({
        baseUrl: `http://127.0.0.1:${port}`,
      });
      // Test connection
      await client.global.health();
      connectedPort = port;
      console.log(`✓ Connected to OpenCode on port ${port}`);
      break;
    } catch (e) {
      // Port not available, try next
    }
  }

  if (!client || !connectedPort) {
    console.error("Could not connect to OpenCode server. Is OpenCode running?");
    console.log("Trying to start embedded server instead...");
    
    // Fall back to creating a new server
    const { createOpencode } = await import("@opencode-ai/sdk");
    const opencode = await createOpencode({
      hostname: "127.0.0.1",
      port: 0,
    });
    client = opencode.client;
    console.log(`Started embedded server at ${opencode.server.url}`);
  }

  // List available agents
  console.log("\n1. Available agents:");
  const agentsResp = await client.app.agents();
  const agents = agentsResp?.data || [];
  const assistant = agents.find((a: any) => a.name === "assistant");
  console.log(`   Found ${agents.length} agents`);
  if (assistant) {
    console.log(`   ✓ Assistant: ${assistant.name} (${assistant.mode})`);
  }

  // Get current session
  console.log("\n2. Current session:");
  console.log(`   Session ID: ${CURRENT_SESSION_ID}`);

  // Try to get session info
  try {
    const session = await client.session.get({ path: { id: CURRENT_SESSION_ID } });
    console.log(`   Session: ${session.data?.title || "Unknown"}`);
  } catch (e) {
    console.log(`   (Session may not exist or not accessible)`);
  }

  // Send message to ask about name
  console.log("\n3. Asking assistant about its name...");
  const message = "你好，请告诉我你的名字是什么？";
  console.log(`   Message: "${message}"`);

  try {
    const result = await client.session.prompt({
      path: { id: CURRENT_SESSION_ID },
      body: {
        parts: [{ type: "text", text: message }],
        agent: "assistant", // Try to use assistant agent
      },
    });

    console.log("\n=== Response ===");
    const responseText = result?.data?.info?.parts?.[0]?.text;
    if (responseText) {
      console.log(responseText.slice(0, 800));
    } else {
      console.log(JSON.stringify(result, null, 2).slice(0, 1000));
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }

  console.log("\n[Done]");
}

main().catch(console.error);
