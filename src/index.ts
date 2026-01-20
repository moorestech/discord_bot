import { startWebServer, stopWebServer } from "./web/server";
import { registerCommands } from "./bot/register";
import { startBot, stopBot } from "./bot/client";

async function main(): Promise<void> {
  console.log("Starting application...");

  // 1. Webサーバを起動
  await startWebServer();

  // 2. スラッシュコマンドを登録
  await registerCommands();

  // 3. Discord botを起動
  await startBot();

  console.log("Application started successfully");
}

// グレースフルシャットダウン
async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down...`);

  try {
    stopBot();
    await stopWebServer();
    console.log("Shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

// シグナルハンドラ
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// エントリポイント
main().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
