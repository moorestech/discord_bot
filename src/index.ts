import { startWebServer, stopWebServer, markStartupComplete } from "./web/server";
import { startBot, stopBot } from "./bot/client";

async function main(): Promise<void> {
  console.log("Starting application...");

  // 1. Webサーバを起動
  await startWebServer();

  // 2. Discord botを起動（レート制限時は長時間かかる場合がある）
  await startBot();

  // 3. 起動完了をヘルスチェックに通知
  markStartupComplete();
  console.log("Application started successfully");

  // コマンド登録は起動時には行わない（既に登録済み）
  // 新しいコマンドを追加した場合のみ、一時的に有効化すること
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
