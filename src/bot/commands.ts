import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const helpJaCommand = new SlashCommandBuilder()
  .setName("help-ja")
  .setDescription("ボットの使い方を表示します（日本語）");

export const helpEnCommand = new SlashCommandBuilder()
  .setName("help-en")
  .setDescription("Show bot usage (English)");

export const addAllToThreadCommand = new SlashCommandBuilder()
  .setName("add-all-to-thread")
  .setDescription("指定スレッドにサーバー全メンバーを追加します（管理者専用）")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((opt) =>
    opt
      .setName("thread")
      .setDescription("対象スレッド")
      .setRequired(true)
      .addChannelTypes(
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread
      )
  );

export const commands = [helpJaCommand, helpEnCommand, addAllToThreadCommand];
