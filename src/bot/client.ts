import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  PermissionsBitField,
} from "discord.js";
import { config } from "../config";

/**
 * 監視したいフォーラムチャンネルIDを配列で設定
 */
const TARGET_FORUM_CHANNEL_IDS: string[] = [
  '1208765744599269386',
];

/**
 * 追加操作の間隔(ms)
 * レート制限を避けるため、0にしない方が安全
 */
const ADD_DELAY_MS = 350;

// Discordの仕様: スレッドに追加できるメンバーは最大1000人
const MAX_THREAD_MEMBERS = 1000;

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

    // すべてのメンバー取得（GuildMembers Intent が必要）
    const allMembers = await thread.guild.members.fetch();

    // そのフォーラムを閲覧できる人だけ対象（見えない人を追加しようとしても失敗しがち）
    const eligible = allMembers.filter(
      (m) =>
        !m.user.bot &&
        m.permissionsIn(parent).has(PermissionsBitField.Flags.ViewChannel)
    );

    // 既に居る人数が取れれば考慮（取れなければ0扱い）
    const currentCount =
      typeof thread.memberCount === "number" ? thread.memberCount : 0;

    // 上限1000まで（現在数を引いた分だけ追加を試みる）
    const maxToAdd = Math.max(0, MAX_THREAD_MEMBERS - currentCount);

    console.log(
      `[thread:${thread.id}] forum=${thread.parentId} eligible=${eligible.size} current=${currentCount} willTryAddUpTo=${maxToAdd}`
    );

    let added = 0;

    for (const member of eligible.values()) {
      if (added >= maxToAdd) break;

      try {
        await thread.members.add(member.id);
        added++;
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        const code = error?.code;
        const msg = String(error?.message ?? "");

        // 代表的な失敗をハンドリング
        if (
          code === 50035 ||
          /maximum.*thread.*member/i.test(msg) ||
          /Maximum number of thread members/i.test(msg)
        ) {
          console.warn(`[thread:${thread.id}] hit member limit; stopping.`);
          break;
        }

        if (code === 50013 || /Missing Permissions/i.test(msg)) {
          console.error(
            `[thread:${thread.id}] Missing permissions to add members.`
          );
          break;
        }

        console.warn(
          `[thread:${thread.id}] add failed member=${member.id} code=${code} msg=${msg}`
        );
      }

      if (ADD_DELAY_MS > 0) await sleep(ADD_DELAY_MS);
    }

    console.log(`[thread:${thread.id}] done. added=${added}`);
  } catch (e) {
    console.error(`[thread:${thread.id}] handler error`, e);
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startBot(): Promise<void> {
  await client.login(config.discordToken);
}

export function stopBot(): void {
  console.log("Discord bot stopping...");
  client.destroy();
  console.log("Discord bot stopped");
}
