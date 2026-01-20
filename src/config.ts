import dotenv from "dotenv";

// ローカル開発用に.envファイルを読み込む
dotenv.config();

interface Config {
  discordToken: string;
  discordClientId: string;
  guildId: string | undefined;
  port: number;
  nodeEnv: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: Required environment variable ${name} is not set`);
    process.exit(1);
  }
  return value;
}

function getOptionalEnv(name: string): string | undefined {
  return process.env[name];
}

export const config: Config = {
  discordToken: getRequiredEnv("DISCORD_TOKEN"),
  discordClientId: getRequiredEnv("DISCORD_CLIENT_ID"),
  guildId: getOptionalEnv("GUILD_ID"),
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
};
