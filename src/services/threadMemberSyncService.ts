import {
  ChannelType,
  Client,
  ForumChannel,
  Guild,
  Message,
  MessageFlags,
  ThreadChannel,
} from "discord.js";
import { TARGET_FORUM_CHANNEL_IDS } from "../bot/events/targetForums";
import {
  addUsersToThreadQuietly,
  findBotMessageInThread,
} from "../bot/events/threadCreate";

const SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000;
const BATCH_SIZE = 10;

class ThreadMemberSyncService {
  private client: Client | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  initialize(client: Client): void {
    this.stop();
    this.client = client;

    if (TARGET_FORUM_CHANNEL_IDS.length === 0) {
      console.log("[ThreadMemberSync] No target forums configured, skipping");
      return;
    }

    this.intervalId = setInterval(() => {
      this.runSync().catch((e) => {
        console.error("[ThreadMemberSync] Sync error:", e);
      });
    }, SYNC_INTERVAL_MS);

    console.log("[ThreadMemberSync] Initialized with 3-hour interval");
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[ThreadMemberSync] Stopped");
    }
  }

  private async runSync(): Promise<void> {
    if (!this.client) return;
    if (this.running) {
      console.log(
        "[ThreadMemberSync] Previous sync still in progress, skipping"
      );
      return;
    }
    this.running = true;
    console.log("[ThreadMemberSync] Starting sync sweep...");

    try {
      for (const [, guild] of this.client.guilds.cache) {
        try {
          await this.syncGuild(guild);
        } catch (e) {
          console.error(`[ThreadMemberSync] Guild ${guild.id} error:`, e);
        }
      }
    } finally {
      this.running = false;
      console.log("[ThreadMemberSync] Sync sweep complete");
    }
  }

  private async syncGuild(guild: Guild): Promise<void> {
    const allMembers = await guild.members.fetch();
    const expectedIds = new Set(
      allMembers.filter((m) => !m.user.bot).map((m) => m.id)
    );

    for (const forumId of TARGET_FORUM_CHANNEL_IDS) {
      try {
        const channel = guild.channels.cache.get(forumId);
        if (!channel || channel.type !== ChannelType.GuildForum) {
          continue;
        }
        const forum = channel as ForumChannel;
        const active = await forum.threads.fetchActive();
        for (const [, thread] of active.threads) {
          try {
            await this.syncThread(thread, expectedIds);
          } catch (e) {
            console.error(
              `[ThreadMemberSync] thread ${thread.id} error:`,
              e
            );
          }
        }
      } catch (e) {
        console.error(`[ThreadMemberSync] forum ${forumId} error:`, e);
      }
    }
  }

  private async syncThread(
    thread: ThreadChannel,
    expectedIds: Set<string>
  ): Promise<void> {
    await thread.join().catch(() => null);

    const actualMembers = await thread.members.fetch();
    const actualIds = new Set(actualMembers.map((m) => m.id));

    const missing: string[] = [];
    for (const id of expectedIds) {
      if (!actualIds.has(id)) missing.push(id);
    }

    if (missing.length === 0) return;

    console.log(
      `[ThreadMemberSync] thread ${thread.id} (${thread.name}): missing=${missing.length}`
    );

    let botMessage: Message | null = await findBotMessageInThread(thread);
    if (!botMessage) {
      botMessage = await thread.send({
        content: "​",
        allowedMentions: { parse: [] },
        flags: MessageFlags.SuppressNotifications,
      });
    }

    let added = 0;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      try {
        botMessage = await addUsersToThreadQuietly(thread, batch, botMessage);
        added += batch.length;
      } catch (e) {
        console.warn(
          `[ThreadMemberSync] failed batch in thread ${thread.id}:`,
          e
        );
      }
    }

    console.log(
      `[ThreadMemberSync] thread ${thread.id}: missing=${missing.length} added=${added}`
    );
  }
}

export const threadMemberSyncService = new ThreadMemberSyncService();
