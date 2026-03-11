/**
 * Queue System Smoke Test
 *
 * Verifies that:
 * 1. Redis connection works
 * 2. An event can be enqueued
 * 3. A worker can receive and process the event
 */

import { EventTypes } from "@atlas/domain";
import { emitEvent, createEventWorker, closeQueue } from "./event-bus.js";

async function test(): Promise<void> {
  console.log("Testing Atlas queue system...\n");

  // Set up a worker that listens for events
  let receivedEvent = false;

  const worker = createEventWorker(async (event) => {
    console.log(`✅ Worker received event: ${event.eventType}`);
    console.log(`   Event ID: ${event.eventId}`);
    console.log(`   Payload:`, JSON.stringify(event.payload, null, 2));
    receivedEvent = true;
  });

  // Give the worker time to connect
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Emit a test event
  console.log("Emitting content.ingested event...");

  const job = await emitEvent(EventTypes.CONTENT_INGESTED, {
    contentItemId: "test-item-001",
    source: "smoke-test",
    timestamp: new Date().toISOString(),
  });

  console.log(`📤 Event enqueued as job: ${job.id}\n`);

  // Wait for the worker to process
  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (receivedEvent) {
    console.log("\n🎉 Queue system working — event enqueued and received!");
  } else {
    console.error("\n❌ Worker did not receive the event");
    process.exit(1);
  }

  // Cleanup
  await worker.close();
  await closeQueue();
  process.exit(0);
}

test().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
