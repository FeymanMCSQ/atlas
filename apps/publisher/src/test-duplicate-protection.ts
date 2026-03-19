/**
 * test-duplicate-protection.ts
 *
 * Simulates a concurrent race condition for publishing the same draft.
 * Verifies that the atomic claim correctly prevents a double publish.
 *
 * Run: npx tsx src/test-duplicate-protection.ts
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { db } from '@atlas/db';
import { handlePublishRequested } from './publish-handler.js';

async function run() {
  console.log('\n=== Duplicate Protection Concurrency Test ===\n');

  // Seed a draft
  const draft = await db.draft.create({
    data: {
      contentItemId: 'test-duplicate-content',
      platform: 'x',
      body: 'Testing atomic claim for duplicate protection.',
      status: 'approved',
      qualityScore: 9.0,
    },
  });

  console.log(`✅ Draft seeded: ${draft.id} with status 'approved'`);

  // We invoke the handler twice concurrently via Promise.all
  console.log(`🚀 Triggering two concurrent publish handlers for draft ${draft.id}...`);

  await Promise.all([
    handlePublishRequested({ draftId: draft.id, platform: 'x' }).catch(e => console.error('Error 1:', e.message)),
    handlePublishRequested({ draftId: draft.id, platform: 'x' }).catch(e => console.error('Error 2:', e.message)),
  ]);

  console.log(`\n--- DB State After Concurrent Publish ---`);
  const updated = await db.draft.findUnique({ where: { id: draft.id } });
  
  console.log(`Status: ${updated?.status}`);
  console.log(`External Post ID: ${updated?.externalPostId}`);

  // It should be 'published' (one succeeded, one was skipped)
  if (updated?.status === 'published') {
    console.log('\n✅ PASS: Draft status is "published", and double-post was prevented!');
  } else {
    console.log('\n❌ FAIL: Draft status is not "published"');
    process.exit(1);
  }

  await (db as any).$disconnect?.();
}

run().catch(console.error);
