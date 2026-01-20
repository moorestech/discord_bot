import { Client, GatewayIntentBits, Interaction } from "discord.js";
import { config } from "../config";

// 最小限のIntents（スラッシュコマンド応答のみ）
export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ready イベント
client.once("ready", () => {
  console.log(`Discord bot logged in as ${client.user?.tag}`);
});

// interactionCreate イベント（スラッシュコマンド処理）
client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ping") {
    console.log(`Received /ping command from ${interaction.user.tag}`);
    await interaction.reply("pong");
  }
});

export async function startBot(): Promise<void> {
  await client.login(config.discordToken);
}

export function stopBot(): void {
  console.log("Discord bot stopping...");
  client.destroy();
  console.log("Discord bot stopped");
}
