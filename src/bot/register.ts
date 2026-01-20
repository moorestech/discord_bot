import { REST, Routes } from "discord.js";
import { config } from "../config";
import { commands } from "./commands";

const rest = new REST({ version: "10" }).setToken(config.discordToken);

export async function registerCommands(): Promise<void> {
  const commandData = commands.map((command) => command.toJSON());

  try {
    if (config.guildId) {
      // ギルド登録（反映が速い）
      await rest.put(
        Routes.applicationGuildCommands(config.discordClientId, config.guildId),
        { body: commandData }
      );
      console.log(
        `Successfully registered ${commands.length} guild command(s) to guild ${config.guildId}`
      );
    } else {
      // グローバル登録（反映に時間がかかる場合がある）
      await rest.put(Routes.applicationCommands(config.discordClientId), {
        body: commandData,
      });
      console.log(
        `Successfully registered ${commands.length} global command(s)`
      );
    }
  } catch (error) {
    console.error("Failed to register commands:", error);
    throw error;
  }
}
