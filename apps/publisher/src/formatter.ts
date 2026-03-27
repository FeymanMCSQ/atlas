import type { Draft } from '@atlas/domain';

// ─── Constants ─────────────────────────────────────────────────────────────

const X_MAX_CHARS = 280;

// ─── Platform Payload Types ─────────────────────────────────────────────────

export interface XPayload {
  platform: 'x';
  text: string;
}

export interface LinkedInPayload {
  platform: 'linkedin';
  author: string;
  commentary: string;
  visibility: 'PUBLIC';
  distribution: {
    feedDistribution: 'MAIN_FEED';
    targetEntities: [];
    thirdPartyDistributionChannels: [];
  };
  lifecycleState: 'PUBLISHED';
  isReshareDisabledByAuthor: boolean;
}

export type PlatformPayload = XPayload | LinkedInPayload;

// ─── Formatter ─────────────────────────────────────────────────────────────

/**
 * Converts a Draft entity into a platform-specific API payload.
 *
 * This is a pure function — no side effects, no API calls.
 * The payload can be handed directly to the corresponding client.
 */
export function formatDraftForPlatform(
  draft: Draft,
  authorUrn?: string
): PlatformPayload {
  if (draft.platform === 'x') {
    return formatForX(draft);
  }

  if (draft.platform === 'linkedin') {
    if (!authorUrn) {
      throw new Error('authorUrn is required for LinkedIn payloads');
    }
    return formatForLinkedIn(draft, authorUrn);
  }

  throw new Error(`Unsupported platform: ${draft.platform}`);
}

// ─── X Formatter ───────────────────────────────────────────────────────────

function formatForX(draft: Draft): XPayload {
  let text = draft.body.trim();

  // X hard limit (280 weighted characters)
  // Our ellipsis character counts as 2, so we slice at 278 to be safe (277 + 2 = 279 weighted)
  if (text.length > X_MAX_CHARS) {
    text = text.slice(0, X_MAX_CHARS - 3) + '…';
  }

  return {
    platform: 'x',
    text,
  };
}

// ─── LinkedIn Formatter ─────────────────────────────────────────────────────

function formatForLinkedIn(draft: Draft, authorUrn: string): LinkedInPayload {
  return {
    platform: 'linkedin',
    author: authorUrn,
    commentary: draft.body.trim(),
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
}
