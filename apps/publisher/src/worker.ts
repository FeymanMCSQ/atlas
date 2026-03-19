/**
 * worker.ts
 *
 * The publisher service worker.
 * Subscribes to the Atlas event queue and routes events to handlers.
 *
 * Retry strategy (for content.publish_requested):
 *   - 3 attempts total
 *   - Exponential backoff: 2s → 4s → 8s
 *   - After exhaustion: Draft marked as "failed", content.publish_failed emitted
 *
 * Start with: npx tsx src/worker.ts
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { db } from '@atlas/db';
import { EventTypes, type AtlasEvent, type ContentPublishRequestedPayload } from '@atlas/domain';
import { createEventWorker, emitEvent } from '@atlas/queue';
import { handlePublishRequested } from './publish-handler.js';

// ─── Retry Configuration ────────────────────────────────────────────────────

const PUBLISH_RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // 2s → 4s → 8s
  },
};

// ─── Worker ─────────────────────────────────────────────────────────────────

const worker = createEventWorker(async (event: AtlasEvent) => {
  if (event.eventType === EventTypes.CONTENT_PUBLISH_REQUESTED) {
    const payload = event.payload as ContentPublishRequestedPayload;
    console.log(`[Worker] Handling ${event.eventType} for draft ${payload.draftId}`);
    await handlePublishRequested(payload);
  }
  // Other event types can be routed here as the service grows
});

// ─── Permanent Failure Handler ───────────────────────────────────────────────

/**
 * Called by BullMQ only after ALL retry attempts are exhausted.
 * This is where we update the draft status and emit the failure event.
 */
worker.on('failed', async (job, err) => {
  if (!job) return;

  const event = job.data as AtlasEvent;
  if (event.eventType !== EventTypes.CONTENT_PUBLISH_REQUESTED) return;

  const { draftId, platform } = event.payload as ContentPublishRequestedPayload;
  const attemptsMade = job.attemptsMade;

  console.error(
    `[Worker] 💀 Draft ${draftId} failed after ${attemptsMade} attempt(s): ${err.message}`
  );

  // Update draft status to permanently failed
  await db.draft.update({
    where: { id: draftId },
    data: { status: 'failed' },
  });

  // Emit failure event for orchestrator to handle
  await emitEvent(EventTypes.CONTENT_PUBLISH_FAILED, {
    draftId,
    platform,
    error: err.message,
  });
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────

worker.on('ready', () => {
  console.log('[Worker] 🚀 Publisher worker ready. Waiting for events...');
});

worker.on('error', (err) => {
  console.error('[Worker] ❌ Worker error:', err);
});

process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...');
  await worker.close();
  process.exit(0);
});

// ─── Export emitPublishRequest helper ────────────────────────────────────────

/**
 * Emit a content.publish_requested event with retry config baked in.
 * Use this instead of calling emitEvent directly for publish flows.
 */
export async function emitPublishRequest(draftId: string, platform: string): Promise<void> {
  await emitEvent(
    EventTypes.CONTENT_PUBLISH_REQUESTED,
    { draftId, platform },
    PUBLISH_RETRY_CONFIG
  );
}
