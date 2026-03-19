/**
 * publish-handler.ts
 *
 * Handles the `content.publish_requested` event.
 *
 * Flow:
 *  1. Fetch Draft from DB
 *  2. Format payload for target platform
 *  3. Post via platform client (X or LinkedIn)
 *  4. Update Draft status in DB
 *  5. Emit content.published or content.publish_failed
 */

import { db } from '@atlas/db';
import { EventTypes, type ContentPublishRequestedPayload } from '@atlas/domain';
import { emitEvent } from '@atlas/queue';
import { sendTweet } from '@atlas/integrations/src/x-client';
import { postToLinkedIn } from '@atlas/integrations/src/linkedin-client';
import { formatDraftForPlatform } from './formatter.js';

/**
 * Core handler for a single content.publish_requested event.
 *
 * Designed to be idempotent — re-running a published draft is a safe no-op.
 *
 * IMPORTANT: This function does NOT catch errors. It throws on failure so
 * BullMQ can automatically retry the job with configured backoff.
 * Permanent failure handling lives in worker.ts via worker.on('failed').
 */
export async function handlePublishRequested(
  payload: ContentPublishRequestedPayload
): Promise<void> {
  const { draftId, platform } = payload;

  // ─── 1. Atomic claim (Duplicate Protection) ─────────────────────────
  const claimResult = await db.draft.updateMany({
    where: { 
      id: draftId,
      status: { in: ['approved', 'failed'] }
    },
    data: { status: 'publishing' }
  });

  if (claimResult.count === 0) {
    console.log(`[Publisher] Draft ${draftId} cannot be published (invalid state or already locked).`);
    return;
  }

  // Fetch the latest draft details now that we have claimed it
  const draft = await db.draft.findUnique({ where: { id: draftId } });
  if (!draft) return; // Should never happen unless deleted concurrently

  // ─── 2. Format payload ────────────────────────────────────────────────
  const domainDraft = {
    ...draft,
    platform: draft.platform as 'x' | 'linkedin',
    status: draft.status as 'pending' | 'approved' | 'published' | 'failed',
    qualityScore: draft.qualityScore,
  };

  const formatted = formatDraftForPlatform(
    domainDraft,
    process.env.LINKEDIN_PERSON_URN
  );

  // ─── 3. Post to platform ──────────────────────────────────────────────
  // Catch errors to revert status, then re-throw for BullMQ retry logic.
  let externalPostId: string;

  try {
    if (platform === 'x' && formatted.platform === 'x') {
      const result = await sendTweet(formatted.text);
      externalPostId = result.id;

    } else if (platform === 'linkedin' && formatted.platform === 'linkedin') {
      const result = await postToLinkedIn(formatted.commentary);
      externalPostId = result.id;

    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  } catch (err: any) {
    // Revert status to 'failed' so BullMQ retries can pick it up again
    await db.draft.update({
      where: { id: draftId },
      data: { status: 'failed' }
    });
    throw err;
  }

  // ─── 4. Update Draft status ───────────────────────────────────────────
  await db.draft.update({
    where: { id: draftId },
    data: { status: 'published', externalPostId },
  });

  console.log(`[Publisher] ✅ Published draft ${draftId} → ${platform} (postId: ${externalPostId})`);

  // ─── 5. Emit success event ────────────────────────────────────────────
  await emitEvent(EventTypes.CONTENT_PUBLISHED, {
    draftId,
    platform,
    externalPostId,
  });
}
