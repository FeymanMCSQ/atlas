/**
 * Emit Test Event
 *
 * Small utility to fire a test event onto the queue.
 * Use this to verify the orchestrator is receiving events.
 *
 * Usage: npx tsx src/emit-test.ts
 */

import { EventTypes } from "@atlas/domain";
import { emitEvent, closeQueue } from "@atlas/queue";

async function main(): Promise<void> {
  console.log("Emitting test content.ingested event...");

  const job = await emitEvent(EventTypes.CONTENT_INGESTED, {
    contentItemId: "test-item-001",
    source: "manual-test",
    timestamp: new Date().toISOString(),
  });

  console.log(`✅ Event enqueued as job: ${job.id}`);

  await closeQueue();
}

main().catch((err) => {
  console.error("Failed to emit event:", err);
  process.exit(1);
});
