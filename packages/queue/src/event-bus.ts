/**
 * Atlas Event Bus
 *
 * Provides a typed interface for emitting and processing Atlas events
 * through BullMQ. This is the primary mechanism for inter-service
 * communication — services emit events instead of calling each other.
 *
 * Uses the EventPayloadMap from @atlas/domain for type safety.
 */

import { Queue, Worker, type Job } from "bullmq";
import { type EventType, type EventPayloadMap, type AtlasEvent } from "@atlas/domain";
import { getRedisConnection } from "./connection.js";

const QUEUE_NAME = "atlas-events";

// ─── Producer ────────────────────────────────────────────────────────

let eventQueue: Queue | null = null;

/**
 * Returns the singleton event queue instance.
 * Lazily initializes on first call.
 */
export function getEventQueue(): Queue {
  if (!eventQueue) {
    eventQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return eventQueue;
}

/**
 * Emit a typed Atlas event onto the queue.
 *
 * @param eventType - One of the EventTypes constants (e.g. "content.ingested")
 * @param payload - The strongly-typed payload for this event type
 * @returns The created job
 */
export async function emitEvent<T extends EventType>(
  eventType: T,
  payload: T extends keyof EventPayloadMap ? EventPayloadMap[T] : never
): Promise<Job> {
  const queue = getEventQueue();

  const event: AtlasEvent<T> = {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    payload,
  };

  const job = await queue.add(eventType, event, {
    removeOnComplete: 100,
    removeOnFail: 200,
  });

  return job;
}

// ─── Consumer ────────────────────────────────────────────────────────

/**
 * Create a worker that processes Atlas events.
 *
 * @param handler - Async function called for each event
 * @returns The BullMQ Worker instance
 */
export function createEventWorker(
  handler: (event: AtlasEvent) => Promise<void>
): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const event = job.data as AtlasEvent;
      await handler(event);
    },
    { connection: getRedisConnection() }
  );

  return worker;
}

// ─── Cleanup ─────────────────────────────────────────────────────────

/**
 * Gracefully close the queue connection.
 * Call this during shutdown.
 */
export async function closeQueue(): Promise<void> {
  if (eventQueue) {
    await eventQueue.close();
    eventQueue = null;
  }
}
