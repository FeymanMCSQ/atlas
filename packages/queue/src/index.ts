/**
 * @atlas/queue
 *
 * Queue abstraction for Atlas event-driven workflows.
 * Built on BullMQ + Redis.
 */

export { getRedisConnection } from "./connection.js";
export { getEventQueue, emitEvent, createEventWorker, closeQueue } from "./event-bus.js";
