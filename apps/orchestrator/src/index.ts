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
import { EventTypes, type AtlasEvent } from "@atlas/domain";
import { getNextAction, buildPayloadForNextEvent } from "./workflow.js";

function main(): void {
  console.log("Atlas orchestrator online");
  // The Orchestrator ONLY consumes events that naturally require routing to a new state.
  // It completely ignores action events (like `content.draft_requested`) so it doesn't 
  // mistakenly steal them from their actual background worker!
  const orchestratingEvents = [
    EventTypes.CONTENT_INGESTED,
    EventTypes.CONTENT_TRANSCRIBED,
    EventTypes.CONTENT_DRAFTED,
    EventTypes.CONTENT_APPROVED,
    EventTypes.CONTENT_PUBLISH_FAILED,
  ];

  const workers = orchestratingEvents.map(eventType => {
    return createEventWorker(eventType, async (event: AtlasEvent) => {
      console.log(`\n======================================================`);
      console.log(`👔 [Orchestrator] Step 1: Received new task -> ${event.eventType}`);
      console.log(`👔 [Orchestrator] Task ID: ${event.eventId}`);
      console.log(`👔 [Orchestrator] Details: ${JSON.stringify(event.payload)}`);

      // Determine the next workflow step
      const action = getNextAction(event.eventType);
      console.log(`👔 [Orchestrator] Step 2: Figuring out what to do next...`);
      console.log(`👔 [Orchestrator] Decision: ${action.description}`);

      if (action.nextEvent) {
        console.log(`👔 [Orchestrator] Step 3: Automatically passing the baton to -> ${action.nextEvent}`);
        
        // Build the payload and emit the next event
        const nextPayload = buildPayloadForNextEvent(event, action.nextEvent);
        await emitEvent(action.nextEvent, nextPayload);
        console.log(`👔 [Orchestrator] ✅ Success! Passed the baton to the next worker.`);
      } else if (action.requiresHumanAction) {
        console.log(`👔 [Orchestrator] Step 3: Stopping completely. A human must click a button to continue.`);
      } else {
        console.log(`👔 [Orchestrator] Step 3: Finished! There is nothing left to do for this task.`);
      }

      console.log(`======================================================\n`);
    });
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down orchestrator...");
    await Promise.all(workers.map(w => w.close()));
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
