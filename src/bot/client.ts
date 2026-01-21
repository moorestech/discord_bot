import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
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

    // 10人ずつメンション→削除を繰り返す
    let added = 0;
    for (let i = 0; i < memberIds.length; i += BATCH_SIZE) {
      const batch = memberIds.slice(i, i + BATCH_SIZE);
      try {
        await addUsersToThreadQuietly(thread, batch);
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
        await addUsersToThreadQuietly(thread, [member.id]);
        console.log(`[GuildMemberAdd] Added ${member.user.tag} to thread ${thread.name}`);
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
 * 空投稿→編集で複数ユーザーメンション→即削除でサイレントにスレッドへ追加
 * 通知を出さずにメンバーをスレッドに参加させる非公式ワークアラウンド
 */
async function addUsersToThreadQuietly(
  thread: ThreadChannel,
  userIds: string[]
): Promise<void> {
  // 1) ゼロ幅スペースで空に近いメッセージを送信（誰もメンションしない）
  const msg = await thread.send({
    content: "\u200B",
    allowedMentions: { parse: [] },
    flags: MessageFlags.SuppressNotifications,
  });

  // 2) 編集で複数ユーザーメンションを付与（編集はping通知が出にくい）
  const mentions = userIds.map((id) => `<@${id}>`).join(" ");
  await msg.edit({
    content: mentions,
    allowedMentions: { users: userIds, parse: [] },
  });

  // 3) すぐ削除（スレッドの見た目を汚さない）
  await msg.delete().catch(() => null);
}

export async function startBot(): Promise<void> {
  await client.login(config.discordToken);
}

export function stopBot(): void {
  console.log("Discord bot stopping...");
  client.destroy();
  console.log("Discord bot stopped");
}
