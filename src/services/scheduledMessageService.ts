import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { Client, TextChannel } from "discord.js";

export interface ScheduleEntry {
  channel_id: string;
  start: string;
  interval: string;
  message: string;
}

export interface ScheduleConfig {
  schedules: ScheduleEntry[];
}

const CHECK_INTERVAL_MS = 60 * 1000; // 1分

/**
 * 間隔文字列をミリ秒に変換
 * 対応フォーマット: "30m", "2h", "1d", "7d"
 */
export function parseInterval(str: string): number {
  const match = str.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(`Invalid interval format: "${str}". Expected format: <number><m|h|d>`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid interval unit: "${unit}"`);
  }
}

/**
 * 現在送信すべきかどうかを判定
 * start時刻からinterval間隔で送信タイミングが来ているか、かつ前回送信から十分な時間が経過しているかを確認
 */
export function shouldSendNow(
  start: Date,
  intervalMs: number,
  now: Date,
  lastSent: Date | null
): boolean {
  const startMs = start.getTime();
  const nowMs = now.getTime();

  // 開始時刻が未来の場合は送信しない
  if (nowMs < startMs) {
    return false;
  }

  // startからの経過時間
  const elapsed = nowMs - startMs;

  // 直近の送信タイミングからの経過時間
  const timeSinceLastSchedule = elapsed % intervalMs;

  // チェック間隔のウィンドウ内（1分）にあるかどうか
  const withinWindow = timeSinceLastSchedule < CHECK_INTERVAL_MS;

  if (!withinWindow) {
    return false;
  }

  // 既に同じウィンドウで送信済みかチェック
  if (lastSent) {
    const lastSentMs = lastSent.getTime();
    const timeSinceLastSent = nowMs - lastSentMs;
    // 前回送信からintervalの半分未満しか経過していなければ、同じウィンドウで送信済み
    if (timeSinceLastSent < intervalMs / 2) {
      return false;
    }
  }

  return true;
}

/**
 * YAMLファイルからスケジュール設定を読み込む
 */
export function loadScheduleConfig(filePath: string): ScheduleConfig {
  if (!fs.existsSync(filePath)) {
    console.warn(`[ScheduledMessageService] Config file not found: ${filePath}`);
    return { schedules: [] };
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.load(fileContent) as ScheduleConfig | null;

  if (!parsed || !parsed.schedules) {
    return { schedules: [] };
  }

  return parsed;
}

class ScheduledMessageService {
  private client: Client | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private scheduleConfig: ScheduleConfig = { schedules: [] };
  private lastSentMap: Map<number, Date> = new Map(); // スケジュールindex → 最終送信日時

  /**
   * サービスを初期化し、定期チェックを開始
   */
  initialize(client: Client): void {
    this.stop();
    this.client = client;
    this.lastSentMap.clear();

    const configPath = path.resolve(process.cwd(), "scheduled-messages.yaml");
    this.scheduleConfig = loadScheduleConfig(configPath);

    if (this.scheduleConfig.schedules.length === 0) {
      console.log("[ScheduledMessageService] No schedules configured, skipping timer setup");
      return;
    }

    console.log(
      `[ScheduledMessageService] Loaded ${this.scheduleConfig.schedules.length} schedule(s)`
    );

    // 初回チェックを実行
    this.checkAndSend();

    // 1分間隔でチェック
    this.intervalId = setInterval(() => {
      this.checkAndSend();
    }, CHECK_INTERVAL_MS);

    console.log("[ScheduledMessageService] Initialized with 1-minute check interval");
  }

  /**
   * タイマーを停止
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[ScheduledMessageService] Stopped");
    }
  }

  /**
   * 各スケジュールをチェックし、該当時刻であればメッセージを送信
   */
  async checkAndSend(): Promise<void> {
    if (!this.client) return;

    const now = new Date();

    for (let i = 0; i < this.scheduleConfig.schedules.length; i++) {
      const schedule = this.scheduleConfig.schedules[i];
      try {
        const start = new Date(schedule.start);
        const intervalMs = parseInterval(schedule.interval);
        const lastSent = this.lastSentMap.get(i) ?? null;

        if (shouldSendNow(start, intervalMs, now, lastSent)) {
          const channel = await this.client.channels.fetch(schedule.channel_id);

          if (!channel || !channel.isTextBased()) {
            console.error(
              `[ScheduledMessageService] Channel not found or not text-based: ${schedule.channel_id}`
            );
            continue;
          }

          await (channel as TextChannel).send(schedule.message);
          this.lastSentMap.set(i, now);
          console.log(
            `[ScheduledMessageService] Sent message to channel ${schedule.channel_id}`
          );
        }
      } catch (error) {
        console.error(
          `[ScheduledMessageService] Error processing schedule #${i}:`,
          error
        );
      }
    }
  }
}

export const scheduledMessageService = new ScheduledMessageService();
