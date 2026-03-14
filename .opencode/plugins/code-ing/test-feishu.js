import { createFeishuClient, createWSClient } from './dist/feishu.js';

async function main() {
  console.log("Starting Feishu test...");
  const client = createFeishuClient("/Users/horizon/work/llm/opencode-ing");
  
  if (!client) {
    console.error("Failed to load Feishu config");
    return;
  }
  console.log("Config loaded. App ID:", client.appId);

  const wsClient = await createWSClient(client, {
    onMessage: (msg) => {
      console.log("TEST MSG RECEIVED:", JSON.stringify(msg, null, 2));
    },
    onConnect: () => console.log("TEST CONNECTED"),
    onDisconnect: () => console.log("TEST DISCONNECTED")
  });

  if (wsClient) {
    console.log("WSClient created successfully. Waiting for messages...");
  } else {
    console.error("Failed to create WSClient");
  }
}

main().catch(console.error);