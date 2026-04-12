/**
 * Atlas Queue Connection
 *
 * Centralizes the Redis connection config used by all queues and workers.
 * Supports both REDIS_URL (Railway format: redis://default:pass@host:port)
 * and individual REDIS_HOST + REDIS_PORT env vars for local dev.
 */

import { type ConnectionOptions } from "bullmq";

export function getRedisConnection(): ConnectionOptions {
  // Check common Railway/Vercel variants for Redis connection strings
  const redisUrl = 
    process.env.REDIS_URL || 
    process.env.REDIS_PUBLIC_URL || 
    process.env.RAILWAY_REDIS_URL;

  if (redisUrl) {
    console.log(`[Queue] Initializing Redis connection with URL (SSL: ${redisUrl.startsWith('rediss')})`);
    try {
      const parsed = new URL(redisUrl);
      const isTls = redisUrl.startsWith("rediss://");
      
      return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 6379,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        username: parsed.username || undefined,
        // BullMQ/ioredis specifics for stability
        maxRetriesPerRequest: null, 
        enableReadyCheck: false,
        connectTimeout: 5000, // Fail fast if we can't connect (5s)
        tls: isTls ? { rejectUnauthorized: false } : undefined,
      };
    } catch (e) {
      console.error(`[Queue] Failed to parse REDIS_URL:`, e);
      throw e;
    }
  }

  // Fallback for local dev - strictly 127.0.0.1 to avoid ipv6 resolution issues
  console.log(`[Queue] ⚠️ No REDIS_URL found. Falling back to local Redis (127.0.0.1:6379)`);
  return {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  };
}
