import { Queue } from "bullmq";
const queue = new Queue("atlas-events", { connection: { host: "localhost", port: 6379 } });
async function check() {
  const completed = await queue.getCompleted(0, 5);
  for (const job of completed) {
    console.log(job.id, job.name, job.data);
  }
  process.exit(0);
}
check();
