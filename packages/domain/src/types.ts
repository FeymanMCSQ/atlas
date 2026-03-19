/**
 * @atlas/domain — shared platform types
 *
 * Enums and value objects for platform-level domain concepts.
 */

// ─── Platform ──────────────────────────────────────────────────────────────

export const Platform = {
  X: 'x',
  LINKEDIN: 'linkedin',
} as const;

export type Platform = (typeof Platform)[keyof typeof Platform];

// ─── Draft Status ──────────────────────────────────────────────────────────

export const DraftStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  FAILED: 'failed',
} as const;

export type DraftStatus = (typeof DraftStatus)[keyof typeof DraftStatus];

// ─── Draft ─────────────────────────────────────────────────────────────────

/**
 * Represents an AI-generated draft post for a specific platform.
 * Mirrors the Prisma Draft model.
 */
export interface Draft {
  id: string;
  contentItemId: string;
  platform: Platform;
  body: string;
  status: DraftStatus;
  qualityScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}
