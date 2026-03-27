/**
 * Atlas Event Bus
 *
 * Provides a typed interface for emitting and processing Atlas events
 * through BullMQ. This is the primary mechanism for inter-service
 * communication — services emit events instead of calling each other.
 *
 * Uses the EventPayloadMap from @atlas/domain for type safety.
 */

import { Queue, Worker, type Job, type JobsOptions } from "bullmq";
import { type EventType, type EventPayloadMap, type AtlasEvent } from "@atlas/domain";
import { getRedisConnection } from "./connection.js";

// ─── Producer ────────────────────────────────────────────────────────

const queues = new Map<string, Queue>();

export function getEventQueue(queueName: string): Queue {
  if (!queues.has(queueName)) {
    queues.set(queueName, new Queue(queueName, {
      connection: getRedisConnection(),
    }));
  }
  return queues.get(queueName)!;
}

/**
 * Emit a typed Atlas event onto the queue.
 *
 * @param eventType - One of the EventTypes constants (e.g. "content.ingested")
 * @param payload - The strongly-typed payload for this event type
 * @param jobOptions - Optional BullMQ job options (e.g. attempts, backoff)
 * @returns The created job
 */
export async function emitEvent<T extends EventType>(
  eventType: T,
  payload: T extends keyof EventPayloadMap ? EventPayloadMap[T] : never,
  jobOptions?: JobsOptions
): Promise<Job> {
  const queue = getEventQueue(eventType);

  const event: AtlasEvent<T> = {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    payload,
  };

  const job = await queue.add(eventType, event, {
    removeOnComplete: 100,
    removeOnFail: 200,
    ...jobOptions,
  });

  return job;
}

// ─── Consumer ────────────────────────────────────────────────────────

/**
 * Create a worker that processes Atlas events from a rigidly assigned channel.
 * This prevents the "competing consumer" silent-drop bug!
 */
export function createEventWorker(
  queueName: string,
  handler: (event: AtlasEvent) => Promise<void>
): Worker {
  const worker = new Worker(
    queueName,
    async (job: Job) => {
      const event = job.data as AtlasEvent;
      await handler(event);
    },
    { connection: getRedisConnection() }
  );

  return worker;
}

// ─── Cleanup ─────────────────────────────────────────────────────────

export async function closeQueue(queueName: string): Promise<void> {
  if (queues.has(queueName)) {
    await queues.get(queueName)!.close();
    queues.delete(queueName);
  }
}
