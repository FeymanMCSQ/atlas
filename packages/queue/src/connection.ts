/**
 * Atlas Queue Connection
 *
 * Centralizes the Redis connection config used by all queues and workers.
 * Connection details come from environment variables with sensible defaults.
 */

import { type ConnectionOptions } from "bullmq";

export function getRedisConnection(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
  };
}
