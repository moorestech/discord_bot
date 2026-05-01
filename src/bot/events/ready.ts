import { Client } from "discord.js";

export function registerReadyHandler(client: Client): void {
  client.once("ready", () => {
    console.log(`Discord bot logged in as ${client.user?.tag}`);
  });
}
