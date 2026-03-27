import { Queue } from "bullmq";
const queue = new Queue("atlas-events", { connection: { host: "localhost", port: 6379 } });
async function check() {
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const completed = await queue.getCompletedCount();
  const failed = await queue.getFailedCount();
  console.log({ waiting, active, completed, failed });
  process.exit(0);
}
check();
