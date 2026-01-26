import { Client, Events, Message } from "discord.js";
import { hrContentService } from "../../services/hrContentService";

export function registerMessageCreateHandler(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    // botのメッセージは無視
    if (message.author.bot) return;

    // 完全一致のみ（大文字小文字区別なし）
    if (message.content.toLowerCase() !== "hr") return;

    const content = hrContentService.getRandomContent();
    if (!content) {
      console.warn("[messageCreate:hr] No content available");
      return;
    }

    // sendメソッドを持つチャンネルか確認
    if (!("send" in message.channel)) {
      return;
    }

    try {
      // ゼロ幅スペースを追加（絵文字のみのメッセージが大きく表示されるのを防ぐ）
      await message.channel.send(content + "\u200B");
      console.log(
        `[messageCreate:hr] Responded to ${message.author.tag} in channel ${message.channel.id}`
      );
    } catch (error) {
      console.error("[messageCreate:hr] Failed to send message:", error);
    }
  });
}
