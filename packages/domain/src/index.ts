/**
 * @atlas/domain
 *
 * Shared schemas, types, and domain definitions for Atlas.
 * All services import from this package for type consistency.
 */

export {
  EventTypes,
  type EventType,
  type ContentIngestedPayload,
  type ContentTranscribedPayload,
  type ContentDraftRequestedPayload,
  type ContentScoredPayload,
  type ContentDraftedPayload,
  type ContentReviewRequestedPayload,
  type ContentApprovedPayload,
  type ContentPublishRequestedPayload,
  type ContentPublishedPayload,
  type ContentPublishFailedPayload,
  type EventPayloadMap,
  type AtlasEvent,
} from "./events.js";
