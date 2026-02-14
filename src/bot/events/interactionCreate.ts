import { Client, Interaction } from "discord.js";

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
  設定ファイル（scheduled-messages.yaml）に基づいて、指定チャンネルに定期的にメッセージを自動送信します`;

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
  Automatically sends messages to specified channels at regular intervals based on the config file (scheduled-messages.yaml)`;

export function registerInteractionCreateHandler(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === "help-ja") {
      console.log(`Received /help-ja command from ${interaction.user.tag}`);
      await interaction.reply(HELP_JA_MESSAGE);
    } else if (commandName === "help-en") {
      console.log(`Received /help-en command from ${interaction.user.tag}`);
      await interaction.reply(HELP_EN_MESSAGE);
    }
  });
}
