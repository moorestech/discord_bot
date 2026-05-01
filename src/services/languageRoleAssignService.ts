import { Client, Guild, Role } from "discord.js";

const ROLE_NAMES = ["🇯🇵japanese", "🇬🇧english"] as const;
const PER_MEMBER_DELAY_MS = 200;
const PROGRESS_LOG_EVERY = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assignForGuild(guild: Guild): Promise<void> {
  const roles: Role[] = [];
  for (const name of ROLE_NAMES) {
    const role = guild.roles.cache.find((r) => r.name === name);
    if (!role) {
      console.error(
        `[LanguageRoleAssign] ロールが見つからないためスキップ: guild=${guild.name}(${guild.id}) role="${name}"`
      );
      return;
    }
    roles.push(role);
  }

  const members = await guild.members.fetch();
  const total = members.size;
  console.log(
    `[LanguageRoleAssign] 開始: guild=${guild.name}(${guild.id}) 対象=${total}人`
  );

  let granted = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (const [, member] of members) {
    processed++;
    const missing = roles.filter((r) => !member.roles.cache.has(r.id));

    if (missing.length === 0) {
      skipped++;
    } else {
      try {
        await member.roles.add(missing, "言語ロール一括付与");
        granted++;
      } catch (error) {
        failed++;
        const reason = error instanceof Error ? error.message : String(error);
        console.error(
          `[LanguageRoleAssign] 失敗: ${member.user.tag} reason=${reason}`
        );
      }
      await sleep(PER_MEMBER_DELAY_MS);
    }

    if (processed % PROGRESS_LOG_EVERY === 0) {
      console.log(`[LanguageRoleAssign] 進行: ${processed}/${total}`);
    }
  }

  console.log(
    `[LanguageRoleAssign] 完了: guild=${guild.name} 付与=${granted} 既保持スキップ=${skipped} 失敗=${failed}`
  );
}

export const languageRoleAssignService = {
  async run(client: Client): Promise<void> {
    if (client.guilds.cache.size === 0) {
      console.warn("[LanguageRoleAssign] ギルドが見つかりません");
      return;
    }
    for (const [, guild] of client.guilds.cache) {
      try {
        await assignForGuild(guild);
      } catch (error) {
        console.error(
          `[LanguageRoleAssign] ギルド処理中にエラー: guild=${guild.name}(${guild.id})`,
          error
        );
      }
    }
  },
};
