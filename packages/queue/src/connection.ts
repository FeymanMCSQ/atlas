/**
 * Atlas Queue Connection
 *
 * Centralizes the Redis connection config used by all queues and workers.
 * Supports both REDIS_URL (Railway format: redis://default:pass@host:port)
 * and individual REDIS_HOST + REDIS_PORT env vars for local dev.
 */

import { type ConnectionOptions } from "bullmq";

export function getRedisConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const parsed = new URL(redisUrl);
    const isTls = redisUrl.startsWith("rediss://");
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      tls: isTls ? {} : undefined,
    };
  }

  // Fallback for local dev without Redis URL
  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
  };
}
