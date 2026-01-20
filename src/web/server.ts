import express, { Application, Request, Response } from "express";
import { Server } from "http";
import { config } from "../config";

const app: Application = express();
let server: Server | null = null;

// GET / - 簡易ページ
app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

// GET /healthz - 監視/Keep-Alive用
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).send("ok");
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
