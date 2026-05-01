import { Client } from "discord.js";
import { languageRoleAssignService } from "../../services/languageRoleAssignService";

export function registerReadyHandler(client: Client): void {
  client.once("ready", () => {
    console.log(`Discord bot logged in as ${client.user?.tag}`);
    void languageRoleAssignService.run(client).catch((error) => {
      console.error("[LanguageRoleAssign] 予期しないエラー", error);
    });
  });
}
