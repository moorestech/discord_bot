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

  await client.login(config.discordToken);
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
