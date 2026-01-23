import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  Message,
  MessageFlags,
  ThreadChannel,
} from "discord.js";
import { config } from "../config";

/**
 * 監視したいフォーラムチャンネルIDを配列で設定
 */
const TARGET_FORUM_CHANNEL_IDS: string[] = [
  '1208765744599269386',
  '1463135499140202517',
];

/**
 * 1回のメンションで追加する人数（100人以上のロールメンションは機能しないため分割）
 */
const BATCH_SIZE = 10;

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ready イベント
client.once("ready", () => {
  console.log(`Discord bot logged in as ${client.user?.tag}`);
});

// interactionCreate イベント（スラッシュコマンド処理）
client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ping") {
    console.log(`Received /ping command from ${interaction.user.tag}`);
    await interaction.reply("pong");
  }
});

// ThreadCreate イベント（フォーラムスレッド作成時にメンバー自動追加）
client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
  // 既存スレッドのキャッシュ読み込み等で発火したケースを避ける
  if (!newlyCreated) return;

  // TARGET_FORUM_CHANNEL_IDSが空の場合は何もしない
  if (TARGET_FORUM_CHANNEL_IDS.length === 0) return;

  // 指定フォーラム以外は無視
  if (!thread.parentId || !TARGET_FORUM_CHANNEL_IDS.includes(thread.parentId))
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

// GuildMemberAdd イベント（新メンバー加入時に既存スレッドへ自動追加）
client.on(Events.GuildMemberAdd, async (member) => {
  // botユーザーは無視
  if (member.user.bot) return;

  // TARGET_FORUM_CHANNEL_IDSが空の場合は何もしない
  if (TARGET_FORUM_CHANNEL_IDS.length === 0) return;

  console.log(`[GuildMemberAdd] New member: ${member.user.tag} (${member.id})`);

  try {
    // 対象フォーラムチャンネルの全アクティブスレッドを取得
    const threads: ThreadChannel[] = [];

    for (const forumId of TARGET_FORUM_CHANNEL_IDS) {
      const channel = member.guild.channels.cache.get(forumId);
      if (!channel || channel.type !== ChannelType.GuildForum) {
        console.warn(`[GuildMemberAdd] Forum channel ${forumId} not found or not a forum`);
        continue;
      }

      const activeThreads = await channel.threads.fetchActive();
      threads.push(...activeThreads.threads.values());
    }

    if (threads.length === 0) {
      console.log(`[GuildMemberAdd] No active threads found for member ${member.user.tag}`);
      return;
    }

    console.log(`[GuildMemberAdd] Adding ${member.user.tag} to ${threads.length} active threads`);

    // 各スレッドに新メンバーを追加
    for (const thread of threads) {
      try {
        await thread.join().catch(() => null);
        // 既存のボットメッセージを探索して編集、なければ新規作成
        const existingMessage = await findBotMessageInThread(thread);
        await addUsersToThreadQuietly(thread, [member.id], existingMessage);
        console.log(`[GuildMemberAdd] Added ${member.user.tag} to thread ${thread.name} (${existingMessage ? 'edited existing' : 'created new'})`);
      } catch (err) {
        console.warn(`[GuildMemberAdd] Failed to add to thread ${thread.id}:`, err);
      }
    }

    console.log(`[GuildMemberAdd] Done adding ${member.user.tag} to all threads`);
  } catch (e) {
    console.error(`[GuildMemberAdd] handler error for ${member.user.tag}`, e);
  }
});

/**
 * スレッド内でボットが投稿した既存メッセージを古い順から探索
 */
async function findBotMessageInThread(thread: ThreadChannel): Promise<Message | null> {
  // after: '0' で古い順から取得（スレッド作成時の最初のメッセージを優先的に見つける）
  const messages = await thread.messages.fetch({ limit: 50, after: '0' });
  const botMessage = messages.find(m => m.author.id === thread.client.user?.id);
  return botMessage ?? null;
}

/**
 * 編集で複数ユーザーメンションを付与してサイレントにスレッドへ追加
 * 通知を出さずにメンバーをスレッドに参加させる非公式ワークアラウンド
 * 既存メッセージがあれば編集、なければ新規作成
 */
async function addUsersToThreadQuietly(
  thread: ThreadChannel,
  userIds: string[],
  existingMessage?: Message | null
): Promise<Message> {
  const mentions = userIds.map((id) => `<@${id}>`).join(" ");

  if (existingMessage) {
    // 既存メッセージを編集
    await existingMessage.edit({
      content: mentions,
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
    content: mentions,
    allowedMentions: { users: userIds, parse: [] },
  });

  return msg;
}

export async function startBot(): Promise<void> {
  await client.login(config.discordToken);
}

export function stopBot(): void {
  console.log("Discord bot stopping...");
  client.destroy();
  console.log("Discord bot stopped");
}
