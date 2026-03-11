/**
 * Emit Test Event
 *
 * Small utility to fire a test event onto the queue.
 * Use this to verify the orchestrator is receiving events.
 *
 * Usage: npx tsx apps/orchestrator/src/emit-test.ts
 */

import { EventTypes } from "@atlas/domain";
import { emitEvent, closeQueue } from "@atlas/queue";

async function main(): Promise<void> {
  const eventType = process.argv[2] || EventTypes.CONTENT_INGESTED;
  console.log(`Emitting test ${eventType} event...\n`);

  let payload: any = {};

  if (eventType === EventTypes.CONTENT_INGESTED) {
    payload = {
      contentItemId: "test-item-001",
      source: "manual-test",
      timestamp: new Date().toISOString(),
    };
  } else if (eventType === EventTypes.CONTENT_APPROVED) {
    payload = {
      draftId: "draft-xyz-789",
      platform: "linkedin",
    };
  } else {
    console.error("Unknown event type for test emitter.");
    process.exit(1);
  }

  const job = await emitEvent(eventType as any, payload);

  console.log(`✅ Event enqueued as job: ${job.id}`);

  await closeQueue();
}

main().catch((err) => {
  console.error("Failed to emit event:", err);
  process.exit(1);
});
