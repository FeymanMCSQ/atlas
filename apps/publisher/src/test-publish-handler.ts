/**
 * test-publish-handler.ts
 *
 * End-to-end test for the Publish Handler.
 *
 * 1. Seeds a Draft into the DB
 * 2. Calls handlePublishRequested directly (no queue required)
 * 3. Verifies the draft status is updated to "published" in DB
 *
 * Run: npx tsx src/test-publish-handler.ts
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { db } from '@atlas/db';
import { handlePublishRequested } from './publish-handler';

const PLATFORM = (process.argv[2] as 'x' | 'linkedin') || 'x';

async function run() {
  console.log(`\n=== Publisher Handler Test (platform: ${PLATFORM}) ===\n`);

  // ─── 1. Seed a draft ─────────────────────────────────────────────────
  const draft = await db.draft.create({
    data: {
      contentItemId: 'test-content-item',
      platform: PLATFORM,
      body: `Most leaders mistake activity for progress.

They optimize for busyness.
They reward hours, not outcomes.
They track effort, not impact.

The shift: measure what moves the needle.
Everything else is noise.

(Atlas publisher test — ${new Date().toISOString()})`,
      status: 'approved',
      qualityScore: 8.7,
    },
  });

  console.log(`✅ Draft seeded: ${draft.id}`);

  // ─── 2. Run the handler ────────────────────────────────────────────
  console.log(`📤 Calling publish handler...`);
  await handlePublishRequested({ draftId: draft.id, platform: PLATFORM });

  // ─── 3. Verify DB state ────────────────────────────────────────────
  const updated = await db.draft.findUnique({ where: { id: draft.id } });

  console.log(`\n--- DB State After Publish ---`);
  console.log(`Status: ${updated?.status}`);
  console.log(`External Post ID: ${updated?.externalPostId}`);

  if (updated?.status === 'published') {
    console.log('\n✅ PASS: Draft status is "published"');
  } else {
    console.log('\n❌ FAIL: Draft status is not "published"');
    process.exit(1);
  }

  await (db as any).$disconnect?.();
}

run().catch(console.error);
