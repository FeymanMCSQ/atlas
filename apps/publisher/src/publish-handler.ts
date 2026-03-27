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
  console.log(`\n📢 [Publisher] Step 1: Checking if draft ${draftId} is officially approved for publishing...`);
  const claimResult = await db.draft.updateMany({
    where: { 
      id: draftId,
      status: { in: ['approved', 'failed'] }
    },
    data: { status: 'publishing' }
  });

  if (claimResult.count === 0) {
    console.log(`📢 [Publisher] ❌ Stopped! This draft is not approved yet, or it's currently locked by another process.`);
    return;
  }

  // Fetch the latest draft details now that we have claimed it
  console.log(`📢 [Publisher] Step 2: Database check passed! Fetching the text we need to post...`);
  const draft = await db.draft.findUnique({ where: { id: draftId } });
  if (!draft) return; // Should never happen unless deleted concurrently

  // ─── 2. Format payload ────────────────────────────────────────────────
  console.log(`📢 [Publisher] Step 3: Properly formatting the text specifically for ${platform}...`);
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
  console.log(`📢 [Publisher] Step 4: Making the official external request to ${platform}'s servers...`);

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
    console.log(`📢 [Publisher] ❌ Failed to post! The external platform (${platform}) completely rejected our request.`);
    console.log(`📢 [Publisher] Reverting database status heavily to 'failed' so our automatic retry system can try again.`);
    // Revert status to 'failed' so BullMQ retries can pick it up again
    await db.draft.update({
      where: { id: draftId },
      data: { status: 'failed' }
    });
    throw err;
  }

  // ─── 4. Update Draft status ───────────────────────────────────────────
  console.log(`📢 [Publisher] Step 5: Success! Saving the live link ID to our database.`);
  await db.draft.update({
    where: { id: draftId },
    data: { status: 'published', externalPostId },
  });

  console.log(`📢 [Publisher] 🎉 The post is officially live on ${platform} with ID: ${externalPostId}`);

  // ─── 5. Emit success event ────────────────────────────────────────────
  console.log(`📢 [Publisher] Step 6: Telling the Orchestrator that we finished our job.`);
  await emitEvent(EventTypes.CONTENT_PUBLISHED, {
    draftId,
    platform,
    externalPostId,
  });
}
