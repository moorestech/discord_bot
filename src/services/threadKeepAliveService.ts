import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { Client, TextChannel, ThreadChannel, ChannelType, SnowflakeUtil } from "discord.js";
import { parseInterval, shouldSendNow } from "./scheduledMessageService";

const CHECK_INTERVAL_MS = 60 * 1000; // 1分ポーリング
const KEEP_ALIVE_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12時間
const KEEP_ALIVE_MESSAGE = "times維持";

interface ThreadKeepAliveConfig {
  start: string;
  interval: string;
  channels: { channel_id: string }[];
}

export function loadKeepAliveConfig(filePath: string): ThreadKeepAliveConfig | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.load(fileContent) as ThreadKeepAliveConfig | null;

  if (!parsed || !parsed.channels || !parsed.start || !parsed.interval) {
    return null;
  }

  return parsed;
}

class ThreadKeepAliveService {
  private client: Client | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private config: ThreadKeepAliveConfig | null = null;
  private lastSent: Date | null = null;

  initialize(client: Client): void {
    this.stop();
    this.client = client;
    this.lastSent = null;

    const configPath = path.resolve(process.cwd(), "thread-keep-alive.yaml");
    this.config = loadKeepAliveConfig(configPath);

    if (!this.config) {
      console.log("[ThreadKeepAlive] No valid config found, skipping");
      return;
    }

    console.log(
      `[ThreadKeepAlive] Loaded ${this.config.channels.length} channel(s), interval: ${this.config.interval}`
    );

    this.intervalId = setInterval(() => {
      this.checkScheduleAndRun();
    }, CHECK_INTERVAL_MS);

    console.log("[ThreadKeepAlive] Initialized with 1-minute polling");
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[ThreadKeepAlive] Stopped");
    }
  }

  private async checkScheduleAndRun(): Promise<void> {
    if (!this.client || !this.config) return;

    const start = new Date(this.config.start);
    const intervalMs = parseInterval(this.config.interval);
    const now = new Date();

    if (!shouldSendNow(start, intervalMs, now, this.lastSent)) return;

    this.lastSent = now;
    console.log("[ThreadKeepAlive] Scheduled time reached, checking threads...");

    for (const entry of this.config.channels) {
      try {
        await this.checkChannel(entry.channel_id);
      } catch (error) {
        console.error(`[ThreadKeepAlive] Error checking channel ${entry.channel_id}:`, error);
      }
    }
  }

  private async checkChannel(channelId: string): Promise<void> {
    if (!this.client) return;

    const channel = await this.client.channels.fetch(channelId);
    if (!channel) {
      console.error(`[ThreadKeepAlive] Channel not found: ${channelId}`);
      return;
    }

    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildForum) {
      console.error(`[ThreadKeepAlive] Channel is not a text/forum channel: ${channelId}`);
      return;
    }

    const textChannel = channel as TextChannel;
    const fetched = await textChannel.threads.fetchActive();
    const threads = fetched.threads;

    if (threads.size === 0) {
      console.log(`[ThreadKeepAlive] No active threads in channel ${channelId}`);
      return;
    }

    const now = Date.now();
    let keptAlive = 0;

    for (const [, thread] of threads) {
      try {
        const remaining = calcRemainingMs(thread, now);
        if (remaining === null) continue;

        if (remaining <= KEEP_ALIVE_THRESHOLD_MS) {
          await thread.send(KEEP_ALIVE_MESSAGE);
          keptAlive++;
          const remainingHours = Math.round(remaining / (60 * 60 * 1000) * 10) / 10;
          console.log(
            `[ThreadKeepAlive] Sent keep-alive to "${thread.name}" (remaining: ${remainingHours}h)`
          );
        }
      } catch (error) {
        console.error(`[ThreadKeepAlive] Error processing thread "${thread.name}":`, error);
      }
    }

    console.log(
      `[ThreadKeepAlive] Channel ${channelId}: ${threads.size} threads checked, ${keptAlive} kept alive`
    );
  }
}

function calcRemainingMs(thread: ThreadChannel, now: number): number | null {
  const duration = thread.autoArchiveDuration;
  if (duration === null || duration === undefined) return null;

  // lastMessageId の Snowflake からタイムスタンプを抽出（archiveTimestamp は stale になりうるため）
  let lastActivityTs: number;
  if (thread.lastMessageId) {
    lastActivityTs = Number(SnowflakeUtil.deconstruct(thread.lastMessageId).timestamp);
  } else if (thread.archiveTimestamp !== null) {
    lastActivityTs = thread.archiveTimestamp;
  } else {
    return null;
  }

  const expiresAt = lastActivityTs + duration * 60 * 1000;
  return expiresAt - now;
}

export const threadKeepAliveService = new ThreadKeepAliveService();
