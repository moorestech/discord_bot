import { ChannelType, Client, Events, ThreadChannel } from "discord.js";
import {
  addUsersToThreadQuietly,
  findBotMessageInThread,
} from "./threadCreate";
import { TARGET_FORUM_CHANNEL_IDS } from "./targetForums";

export function registerGuildMemberAddHandler(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member) => {
    // botユーザーは無視
    if (member.user.bot) return;

    // TARGET_FORUM_CHANNEL_IDSが空の場合は何もしない
    if (TARGET_FORUM_CHANNEL_IDS.length === 0) return;

    console.log(
      `[GuildMemberAdd] New member: ${member.user.tag} (${member.id})`
    );

    try {
      // 対象フォーラムチャンネルの全アクティブスレッドを取得
      const threads: ThreadChannel[] = [];

      for (const forumId of TARGET_FORUM_CHANNEL_IDS) {
        const channel = member.guild.channels.cache.get(forumId);
        if (!channel || channel.type !== ChannelType.GuildForum) {
          console.warn(
            `[GuildMemberAdd] Forum channel ${forumId} not found or not a forum`
          );
          continue;
        }

        const activeThreads = await channel.threads.fetchActive();
        threads.push(...activeThreads.threads.values());
      }

      if (threads.length === 0) {
        console.log(
          `[GuildMemberAdd] No active threads found for member ${member.user.tag}`
        );
        return;
      }

      console.log(
        `[GuildMemberAdd] Adding ${member.user.tag} to ${threads.length} active threads`
      );

      // 各スレッドに新メンバーを追加
      for (const thread of threads) {
        try {
          await thread.join().catch(() => null);
          // 既存のボットメッセージを探索して編集、なければ新規作成
          const existingMessage = await findBotMessageInThread(thread);
          await addUsersToThreadQuietly(thread, [member.id], existingMessage);
          console.log(
            `[GuildMemberAdd] Added ${member.user.tag} to thread ${thread.name} (${existingMessage ? "edited existing" : "created new"})`
          );
        } catch (err) {
          console.warn(
            `[GuildMemberAdd] Failed to add to thread ${thread.id}:`,
            err
          );
        }
      }

      console.log(
        `[GuildMemberAdd] Done adding ${member.user.tag} to all threads`
      );
    } catch (e) {
      console.error(
        `[GuildMemberAdd] handler error for ${member.user.tag}`,
        e
      );
    }
  });
}
