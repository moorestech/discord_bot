import {
  ChannelType,
  Client,
  Events,
  Message,
  MessageFlags,
  ThreadChannel,
} from "discord.js";
import { TARGET_FORUM_CHANNEL_IDS } from "./targetForums";
import { enqueueAddAllMembersToThread } from "../services/threadMemberAddService";

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
      await enqueueAddAllMembersToThread(thread);
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
    content: "​",
    allowedMentions: { parse: [] },
    flags: MessageFlags.SuppressNotifications,
  });

  await msg.edit({
    content,
    allowedMentions: { users: userIds, parse: [] },
  });

  return msg;
}
