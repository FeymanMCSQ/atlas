/**
 * test-formatter.ts
 *
 * Verifies that the platform formatter correctly transforms a Draft
 * into the right payload for X and LinkedIn.
 *
 * Runs against a mock draft (no DB required).
 */

import { formatDraftForPlatform } from './formatter';
import type { Draft } from '@atlas/domain';

// ─── Mock Draft ─────────────────────────────────────────────────────────────

const mockDraft: Draft = {
  id: 'test-draft-001',
  contentItemId: 'content-item-001',
  platform: 'x',
  body: `Most companies treat content as a megaphone.

They push messages out. They count impressions.
They wonder why nothing sticks.

The shift: content as a conversation.
Not talking at people. Thinking with them.

That's the difference between noise and signal.`,
  status: 'approved',
  qualityScore: 8.5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const LINKEDIN_PERSON_URN = process.env.LINKEDIN_PERSON_URN || 'urn:li:person:test';

// ─── Run Tests ──────────────────────────────────────────────────────────────

console.log('=== Atlas Formatter Test ===\n');

// 1. Format for X
console.log('--- X (Twitter) Payload ---');
const xPayload = formatDraftForPlatform({ ...mockDraft, platform: 'x' });
if (xPayload.platform === 'x') {
  console.log(`Characters: ${xPayload.text.length}/280`);
  console.log(`Text:\n${xPayload.text}`);
}

console.log('\n--- LinkedIn Payload ---');
const liPayload = formatDraftForPlatform(
  { ...mockDraft, platform: 'linkedin' },
  LINKEDIN_PERSON_URN
);
if (liPayload.platform === 'linkedin') {
  console.log(`Author URN: ${liPayload.author}`);
  console.log(`Commentary:\n${liPayload.commentary}`);
  console.log(`\nFull Payload:\n${JSON.stringify(liPayload, null, 2)}`);
}

// 2. Test truncation
console.log('\n--- X Truncation Test (long draft) ---');
const longDraft: Draft = {
  ...mockDraft,
  body: 'A'.repeat(350),
};
const truncated = formatDraftForPlatform(longDraft);
if (truncated.platform === 'x') {
  const pass = truncated.text.length <= 280;
  console.log(`Length after truncation: ${truncated.text.length}/280 — ${pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Ends with ellipsis: ${truncated.text.endsWith('…') ? '✅' : '❌'}`);
}

console.log('\n✅ Formatter test complete.');
