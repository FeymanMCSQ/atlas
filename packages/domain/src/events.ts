/**
 * Atlas Event Types
 *
 * All system events that flow through the queue.
 * Services communicate exclusively through these events
 * rather than calling each other directly.
 *
 * See docs/03_event_flow.md for full event lifecycle.
 */

// ─── Event Type Constants ────────────────────────────────────────────

export const EventTypes = {
  /** Emitted by Feed Ingestor when a new feed item has been normalized and stored */
  CONTENT_INGESTED: "content.ingested",

  /** Emitted by Transcriber when audio has been converted to text */
  CONTENT_TRANSCRIBED: "content.transcribed",

  /** Emitted by Orchestrator to trigger Content Brain to score and draft content */
  CONTENT_DRAFT_REQUESTED: "content.draft_requested",

  /** Emitted by Content Brain when relevance and topic analysis completes */
  CONTENT_SCORED: "content.scored",

  /** Emitted by Content Brain when AI-generated drafts are produced */
  CONTENT_DRAFTED: "content.drafted",

  /** Emitted by Orchestrator when drafts are ready for human review */
  CONTENT_REVIEW_REQUESTED: "content.review_requested",

  /** Emitted by Orchestrator when a draft passes review */
  CONTENT_APPROVED: "content.approved",

  /** Emitted by Orchestrator when a draft should be published */
  CONTENT_PUBLISH_REQUESTED: "content.publish_requested",

  /** Emitted by Publisher when a post has been successfully published */
  CONTENT_PUBLISHED: "content.published",

  /** Emitted by Publisher when publishing fails */
  CONTENT_PUBLISH_FAILED: "content.publish_failed",

  /** Emitted by Frontend to trigger a manual Resonance Engine hunt */
  RESONANCE_HUNT_REQUESTED: "resonance.hunt_requested",
} as const;


export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// ─── Event Payloads ──────────────────────────────────────────────────

export interface ContentIngestedPayload {
  contentItemId: string;
  source: string;
  timestamp: string;
}

export interface ContentTranscribedPayload {
  contentItemId: string;
  transcriptId: string;
  timestamp: string;
}

export interface ContentDraftRequestedPayload {
  contentItemId: string;
  model?: string;
}

export interface ContentScoredPayload {
  contentItemId: string;
  score: number;
  tags: string[];
}

export interface ContentDraftedPayload {
  contentItemId: string;
  draftIds: string[];
  platforms: string[];
}

export interface ContentReviewRequestedPayload {
  contentItemId: string;
  draftIds: string[];
}

export interface ContentApprovedPayload {
  draftId: string;
  platform: string;
}

export interface ContentPublishRequestedPayload {
  draftId: string;
  platform: string;
  isManual?: boolean; // true = triggered by user clicking Publish in the UI
}

export interface ContentPublishedPayload {
  draftId: string;
  platform: string;
  externalPostId: string;
}

export interface ContentPublishFailedPayload {
  draftId: string;
  platform: string;
  error: string;
}

// ─── Payload Map ─────────────────────────────────────────────────────

/**
 * Maps each event type to its strongly-typed payload.
 * Used to enforce type safety when emitting or handling events.
 */
export interface EventPayloadMap {
  [EventTypes.CONTENT_INGESTED]: ContentIngestedPayload;
  [EventTypes.CONTENT_TRANSCRIBED]: ContentTranscribedPayload;
  [EventTypes.CONTENT_DRAFT_REQUESTED]: ContentDraftRequestedPayload;
  [EventTypes.CONTENT_SCORED]: ContentScoredPayload;
  [EventTypes.CONTENT_DRAFTED]: ContentDraftedPayload;
  [EventTypes.CONTENT_REVIEW_REQUESTED]: ContentReviewRequestedPayload;
  [EventTypes.CONTENT_APPROVED]: ContentApprovedPayload;
  [EventTypes.CONTENT_PUBLISH_REQUESTED]: ContentPublishRequestedPayload;
  [EventTypes.CONTENT_PUBLISHED]: ContentPublishedPayload;
  [EventTypes.CONTENT_PUBLISH_FAILED]: ContentPublishFailedPayload;
  [EventTypes.RESONANCE_HUNT_REQUESTED]: {};
}


// ─── Event Envelope ──────────────────────────────────────────────────

/**
 * Generic event envelope wrapping any event type with its payload.
 * Every event flowing through the system uses this structure.
 */
export interface AtlasEvent<T extends EventType = EventType> {
  eventId: string;
  eventType: T;
  timestamp: string;
  payload: T extends keyof EventPayloadMap ? EventPayloadMap[T] : never;
}
