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
 * スレッド追加通知用のロール名
 */
const THREAD_ADD_ROLE_NAME = 'twee-add';

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

    // ロールを検索
    const role = thread.guild.roles.cache.find(
      (r) => r.name === THREAD_ADD_ROLE_NAME
    );

    if (!role) {
      console.warn(
        `[thread:${thread.id}] Role "${THREAD_ADD_ROLE_NAME}" not found`
      );
      return;
    }

    // サーバーの全メンバーを取得し、twee-addロールがなければ付与
    const allMembers = await thread.guild.members.fetch();
    for (const [, member] of allMembers) {
      // botは除外
      if (member.user.bot) continue;

      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        console.log(
          `[thread:${thread.id}] Added role "${THREAD_ADD_ROLE_NAME}" to member ${member.user.tag}`
        );
      }
    }

    // twee-addロールを持つメンバーを取得
    const membersWithRole = allMembers.filter(
      (m) => !m.user.bot && m.roles.cache.has(role.id)
    );

    console.log(
      `[thread:${thread.id}] forum=${thread.parentId} adding ${membersWithRole.size} members with role=${role.name}`
    );

    // 1人ずつメンション→削除を繰り返す（100人以上のロールメンションは機能しないため）
    let added = 0;
    for (const [, member] of membersWithRole) {
      try {
        await addUserToThreadQuietly(thread, member.id);
        added++;
      } catch (err) {
        console.warn(
          `[thread:${thread.id}] Failed to add member ${member.user.tag}:`,
          err
        );
      }
    }

    console.log(`[thread:${thread.id}] done. added=${added}`);
  } catch (e) {
    console.error(`[thread:${thread.id}] handler error`, e);
  }
});

/**
 * 空投稿→編集でユーザーメンション→即削除でサイレントにスレッドへ追加
 * 通知を出さずにメンバーをスレッドに参加させる非公式ワークアラウンド
 */
async function addUserToThreadQuietly(
  thread: ThreadChannel,
  userId: string
): Promise<void> {
  // 1) ゼロ幅スペースで空に近いメッセージを送信（誰もメンションしない）
  const msg = await thread.send({
    content: "\u200B",
    allowedMentions: { parse: [] },
    flags: MessageFlags.SuppressNotifications,
  });

  // 2) 編集でユーザーメンションを付与（編集はping通知が出にくい）
  await msg.edit({
    content: `<@${userId}>`,
    allowedMentions: { users: [userId], parse: [] },
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
