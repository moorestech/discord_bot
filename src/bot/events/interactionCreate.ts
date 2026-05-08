import { Client, Interaction, MessageFlags, PermissionFlagsBits } from "discord.js";
import { enqueueAddAllMembersToThread } from "../services/threadMemberAddService";

const HELP_JA_MESSAGE = `**このボットの機能**

• **tweetスレッドへの人の追加**
  新しいメンバーが参加すると、アクティブなtweetスレッドに自動追加されます
  （メンションは参加用で、メンションの通知も行われません）

• **hrでラインを作成**
  hrと入力すると区切り線を作成します
  話題を切り替えたい時、話題の区切りとして使用します（「horizontal rule」の略）

• **hrの追加**
  hrの内容は自由に追加できます
  追加はこのスプレッドシートのA列に追加してください：
  <https://docs.google.com/spreadsheets/d/1mUq2SPF7O4I2HH9zROUI1y9m3x8GVTQznJLc-opvrM0/edit?usp=sharing>
  ※反映まで2〜3分程度かかります

• **定期メッセージ送信**
  設定ファイル（scheduled-messages.yaml）に基づいて、指定チャンネルに定期的にメッセージを自動送信します

• **timesスレッド自動維持**
  6時間ごとに指定チャンネルのスレッドをチェックし、自動アーカイブまで残り12時間以内のスレッドにメッセージを投稿して維持します

• **スレッドに全員を追加（管理者専用）**
  \`/add-all-to-thread\` で指定スレッドにサーバー全メンバーを追加します`;

const HELP_EN_MESSAGE = `**Bot Features**

• **Auto-add users to tweet threads**
  When new members join, they are automatically added to active tweet threads
  (Mentions are for joining only; no notifications are sent)

• **Create separator lines with hr**
  Type "hr" to create a separator line
  Use it when you want to switch topics or mark topic boundaries ("horizontal rule")

• **Add custom hr content**
  You can freely add hr content
  Add entries to column A in this spreadsheet:
  <https://docs.google.com/spreadsheets/d/1mUq2SPF7O4I2HH9zROUI1y9m3x8GVTQznJLc-opvrM0/edit?usp=sharing>
  *Changes take 2-3 minutes to reflect

• **Scheduled messages**
  Automatically sends messages to specified channels at regular intervals based on the config file (scheduled-messages.yaml)

• **Auto thread keep-alive**
  Checks threads in a specified channel every 6 hours. If a thread is within 12 hours of being auto-archived, a message is posted to keep it alive

• **Add all members to a thread (admin only)**
  Use \`/add-all-to-thread\` to add every server member to the specified thread`;

export function registerInteractionCreateHandler(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
      if (commandName === "help-ja") {
        console.log(`Received /help-ja command from ${interaction.user.tag}`);
        await interaction.reply(HELP_JA_MESSAGE);
        console.log(`Replied to /help-ja from ${interaction.user.tag}`);
      } else if (commandName === "help-en") {
        console.log(`Received /help-en command from ${interaction.user.tag}`);
        await interaction.reply(HELP_EN_MESSAGE);
        console.log(`Replied to /help-en from ${interaction.user.tag}`);
      } else if (commandName === "add-all-to-thread") {
        await handleAddAllToThread(interaction);
      }
    } catch (error) {
      console.error(`[interactionCreate] Failed to reply to /${commandName}:`, error);
    }
  });
}

async function handleAddAllToThread(
  interaction: import("discord.js").ChatInputCommandInteraction
): Promise<void> {
  console.log(
    `Received /add-all-to-thread command from ${interaction.user.tag}`
  );

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "このコマンドは管理者のみ実行できます。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = interaction.options.getChannel("thread", true);
  const resolved = interaction.guild?.channels.cache.get(channel.id) ?? null;
  if (!resolved || !resolved.isThread()) {
    await interaction.reply({
      content: "スレッドを指定してください。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const { added, total } = await enqueueAddAllMembersToThread(resolved);
    await interaction.editReply(
      `<#${resolved.id}> に ${added}/${total} 人を追加しました。`
    );
    console.log(
      `[add-all-to-thread] ${interaction.user.tag} added ${added}/${total} to ${resolved.id}`
    );
  } catch (e) {
    console.error(
      `[add-all-to-thread] failed for ${resolved.id}:`,
      e
    );
    await interaction.editReply(
      `エラーが発生しました: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
