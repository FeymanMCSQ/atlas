/**
 * Atlas Orchestrator
 *
 * Coordinates system workflows and manages job sequencing.
 * The orchestrator does not perform domain work —
 * it only coordinates other services via events and state transitions.
 *
 * This entry point starts the event worker that listens for
 * all Atlas events, logs them, and determines the next workflow step.
 */

import { createEventWorker, emitEvent } from "@atlas/queue";
import type { AtlasEvent } from "@atlas/domain";
import { getNextAction, buildPayloadForNextEvent } from "./workflow.js";

function main(): void {
  console.log("Atlas orchestrator online");
  console.log("Listening for events...\n");

  const worker = createEventWorker(async (event: AtlasEvent) => {
    console.log(`[event] ${event.eventType}`);
    console.log(`        id:        ${event.eventId}`);
    console.log(`        timestamp: ${event.timestamp}`);
    console.log(`        payload:   ${JSON.stringify(event.payload)}`);

    // Determine the next workflow step
    const action = getNextAction(event.eventType);
    console.log(`[workflow] ${action.description}`);

    if (action.nextEvent) {
      console.log(`[workflow] next → ${action.nextEvent}`);
      
      // Build the payload and emit the next event
      const nextPayload = buildPayloadForNextEvent(event, action.nextEvent);
      await emitEvent(action.nextEvent, nextPayload);
      console.log(`[workflow] ✅ Emitted ${action.nextEvent}`);
    } else if (action.requiresHumanAction) {
      console.log(`[workflow] ⏸ paused — waiting for human action`);
    } else {
      console.log(`[workflow] ✓ terminal — no further action`);
    }

    console.log();
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down orchestrator...");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
