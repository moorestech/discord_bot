import { Message, MessageFlags, ThreadChannel } from "discord.js";
import { addUsersToThreadQuietly } from "../events/threadCreate";

const BATCH_SIZE = 10;

export interface AddAllMembersResult {
  added: number;
  total: number;
}

let queue: Promise<unknown> = Promise.resolve();

export function enqueueAddAllMembersToThread(
  thread: ThreadChannel
): Promise<AddAllMembersResult> {
  const task = queue.then(() => runAddAll(thread));
  queue = task.catch(() => undefined);
  return task;
}

async function runAddAll(thread: ThreadChannel): Promise<AddAllMembersResult> {
  await thread.join().catch(() => null);

  const allMembers = await thread.guild.members.fetch();
  const targetMembers = allMembers.filter((m) => !m.user.bot);
  const memberIds = [...targetMembers.keys()];
  const total = memberIds.length;

  console.log(
    `[threadMemberAdd:${thread.id}] adding ${total} members in batches of ${BATCH_SIZE}`
  );

  let botMessage: Message | null = await thread.send({
    content: "​",
    allowedMentions: { parse: [] },
    flags: MessageFlags.SuppressNotifications,
  });

  let added = 0;
  for (let i = 0; i < memberIds.length; i += BATCH_SIZE) {
    const batch = memberIds.slice(i, i + BATCH_SIZE);
    try {
      botMessage = await addUsersToThreadQuietly(thread, batch, botMessage);
      added += batch.length;
    } catch (err) {
      console.warn(
        `[threadMemberAdd:${thread.id}] Failed to add batch starting at ${i}:`,
        err
      );
    }
  }

  console.log(`[threadMemberAdd:${thread.id}] done. added=${added}/${total}`);
  return { added, total };
}
