import {
  ChannelType,
  Client,
  Events,
  Message,
  MessageFlags,
  ThreadChannel,
} from "discord.js";
import { TARGET_FORUM_CHANNEL_IDS } from "./targetForums";

/**
 * 1回のメンションで追加する人数（100人以上のロールメンションは機能しないため分割）
 */
const BATCH_SIZE = 10;

/**
 * ユーザー追加時に表示する説明メッセージ（日英併記）
 */
const ADD_USERS_EXPLANATION = `
---
このメンションはスレッドへの参加用です。メンションの通知も行われません。
These mentions are for adding users to the thread. No notifications are sent.`;

export function registerThreadCreateHandler(client: Client): void {
  client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
    // 既存スレッドのキャッシュ読み込み等で発火したケースを避ける
    if (!newlyCreated) return;

    // TARGET_FORUM_CHANNEL_IDSが空の場合は何もしない
    if (TARGET_FORUM_CHANNEL_IDS.length === 0) return;

    // 指定フォーラム以外は無視
    if (
      !thread.parentId ||
      !TARGET_FORUM_CHANNEL_IDS.includes(thread.parentId)
    )
      return;

    const parent = thread.parent;
    if (!parent) return;

    // フォーラムであることを念のため確認
    if (parent.type !== ChannelType.GuildForum) {
      console.warn(
        `Matched parentId but parent is not a forum. parentType=${parent.type}`
      );
    }

    try {
      // スレッドにbot自身が入ってないと操作できないケースがあるので join
      await thread.join().catch(() => null);

      // サーバーの全メンバーを取得（botを除く）
      const allMembers = await thread.guild.members.fetch();
      const targetMembers = allMembers.filter((m) => !m.user.bot);
      const memberIds = [...targetMembers.keys()];

      console.log(
        `[thread:${thread.id}] forum=${thread.parentId} adding ${memberIds.length} members in batches of ${BATCH_SIZE}`
      );

      // 最初に1つの空メッセージを作成
      let botMessage: Message | null = await thread.send({
        content: "\u200B",
        allowedMentions: { parse: [] },
        flags: MessageFlags.SuppressNotifications,
      });

      // 10人ずつ同じメッセージを編集して追加
      let added = 0;
      for (let i = 0; i < memberIds.length; i += BATCH_SIZE) {
        const batch = memberIds.slice(i, i + BATCH_SIZE);
        try {
          botMessage = await addUsersToThreadQuietly(thread, batch, botMessage);
          added += batch.length;
        } catch (err) {
          console.warn(
            `[thread:${thread.id}] Failed to add batch starting at ${i}:`,
            err
          );
        }
      }

      console.log(`[thread:${thread.id}] done. added=${added}`);
    } catch (e) {
      console.error(`[thread:${thread.id}] handler error`, e);
    }
  });
}

/**
 * スレッド内でボットが投稿した既存メッセージを古い順から探索
 */
export async function findBotMessageInThread(
  thread: ThreadChannel
): Promise<Message | null> {
  // after: '0' で古い順から取得（スレッド作成時の最初のメッセージを優先的に見つける）
  const messages = await thread.messages.fetch({ limit: 50, after: "0" });
  const botMessage = messages.find(
    (m) => m.author.id === thread.client.user?.id
  );
  return botMessage ?? null;
}

/**
 * 編集で複数ユーザーメンションを付与してサイレントにスレッドへ追加
 * 通知を出さずにメンバーをスレッドに参加させる非公式ワークアラウンド
 * 既存メッセージがあれば編集、なければ新規作成
 */
export async function addUsersToThreadQuietly(
  thread: ThreadChannel,
  userIds: string[],
  existingMessage?: Message | null
): Promise<Message> {
  const mentions = userIds.map((id) => `<@${id}>`).join(" ");
  const content = mentions + ADD_USERS_EXPLANATION;

  if (existingMessage) {
    // 既存メッセージを編集
    await existingMessage.edit({
      content,
      allowedMentions: { users: userIds, parse: [] },
    });
    return existingMessage;
  }

  // 新規メッセージを作成して編集
  const msg = await thread.send({
    content: "\u200B",
    allowedMentions: { parse: [] },
    flags: MessageFlags.SuppressNotifications,
  });

  await msg.edit({
    content,
    allowedMentions: { users: userIds, parse: [] },
  });

  return msg;
}
