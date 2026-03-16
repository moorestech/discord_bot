import { Client, GatewayIntentBits } from "discord.js";
import { config } from "../config";
import { registerEventHandlers } from "./events";
import { hrContentService } from "../services/hrContentService";
import { scheduledMessageService } from "../services/scheduledMessageService";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// イベントハンドラを登録
registerEventHandlers(client);

export async function startBot(): Promise<void> {
  // HRコンテンツサービスを初期化
  await hrContentService.initialize();

  // ready後に定期メッセージサービスを初期化
  client.once("ready", () => {
    scheduledMessageService.initialize(client);
  });

  // デバッグ用イベントリスナー
  client.on("warn", (msg) => console.warn("[Discord WARN]", msg));
  client.on("error", (err) => console.error("[Discord ERROR]", err));
  client.on("shardError", (err) => console.error("[Discord SHARD ERROR]", err));
  client.on("shardDisconnect", (ev, id) => console.warn(`[Discord] Shard ${id} disconnected`));
  client.on("shardReconnecting", (id) => console.log(`[Discord] Shard ${id} reconnecting...`));

  console.log("[startBot] Calling client.login()...");
  await client.login(config.discordToken);
  console.log("[startBot] client.login() resolved");
}

export function stopBot(): void {
  console.log("Discord bot stopping...");

  // HRコンテンツサービスを停止
  hrContentService.stop();

  // 定期メッセージサービスを停止
  scheduledMessageService.stop();

  client.destroy();
  console.log("Discord bot stopped");
}
