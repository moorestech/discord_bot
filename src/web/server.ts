import express, { Application, Request, Response } from "express";
import { Server } from "http";
import { config } from "../config";
import { client } from "../bot/client";

const app: Application = express();
let server: Server | null = null;
const startedAt = Date.now();
const STARTUP_GRACE_MS = 2 * 60 * 1000; // 起動後2分間は猶予

// GET / - 簡易ページ
app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

// GET /healthz - 監視/Keep-Alive用（Discord接続状態も確認）
app.get("/healthz", (_req: Request, res: Response) => {
  const isDiscordReady = client.isReady();
  const isStartingUp = Date.now() - startedAt < STARTUP_GRACE_MS;

  if (isDiscordReady || isStartingUp) {
    res.status(200).send("ok");
  } else {
    console.warn("[HealthCheck] Discord client is not ready, returning 503");
    res.status(503).send("discord not ready");
  }
});

export function startWebServer(): Promise<Server> {
  return new Promise((resolve) => {
    server = app.listen(config.port, "0.0.0.0", () => {
      console.log(`Listening on :${config.port}`);
      resolve(server!);
    });
  });
}

export function stopWebServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log("Web server stopped");
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}
