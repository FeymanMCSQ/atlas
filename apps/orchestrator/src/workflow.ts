/**
 * Atlas Workflow Engine
 *
 * Maps incoming events to the next step in the content pipeline.
 * This is the core decision-making logic of the orchestrator.
 *
 * The orchestrator does NOT perform domain work — it only decides
 * what should happen next and emits the appropriate event or action.
 *
 * Pipeline flow (from docs/03_event_flow.md):
 *
 *   content.ingested / content.transcribed
 *     → request drafts (content.draft_requested)
 *     → (Content Brain scores & drafts)
 *   content.drafted
 *     → request human review
 *   content.review_requested
 *     → (wait for human action)
 *   content.approved
 *     → request publishing
 *   content.publish_requested
 *     → (publisher handles it)
 *   content.published
 *     → done
 *   content.publish_failed
 *     → retry or escalate
 */

import { EventTypes, type EventType, type AtlasEvent } from "@atlas/domain";

// ─── Workflow Actions ────────────────────────────────────────────────

/**
 * Describes what the orchestrator should do next
 * in response to a received event.
 */
export interface WorkflowAction {
  /** The event that should be emitted next, or null if the pipeline terminates */
  nextEvent: EventType | null;

  /** Human-readable description of what this step does */
  description: string;

  /** Whether this step requires human intervention before proceeding */
  requiresHumanAction: boolean;
}

// ─── Event → Next Step Mapping ───────────────────────────────────────

const workflowMap: Record<EventType, WorkflowAction> = {
  [EventTypes.CONTENT_INGESTED]: {
    nextEvent: EventTypes.CONTENT_DRAFT_REQUESTED,
    description: "Request drafts for the ingested content",
    requiresHumanAction: false,
  },

  [EventTypes.CONTENT_TRANSCRIBED]: {
    nextEvent: EventTypes.CONTENT_DRAFT_REQUESTED,
    description: "Request drafts for the transcribed content",
    requiresHumanAction: false,
  },

  [EventTypes.CONTENT_DRAFT_REQUESTED]: {
    nextEvent: null,
    description: "Content Brain will generate narrative drafts",
    requiresHumanAction: false,
  },

  [EventTypes.CONTENT_SCORED]: {
    nextEvent: null, // Scored is an intermediate event handled by Brain
    description: "Content was scored",
    requiresHumanAction: false,
  },

  [EventTypes.CONTENT_DRAFTED]: {
    nextEvent: EventTypes.CONTENT_REVIEW_REQUESTED,
    description: "Request human review for generated drafts",
    requiresHumanAction: false,
  },

  [EventTypes.CONTENT_REVIEW_REQUESTED]: {
    nextEvent: null,
    description: "Waiting for human review",
    requiresHumanAction: true,
  },

  [EventTypes.CONTENT_APPROVED]: {
    nextEvent: EventTypes.CONTENT_PUBLISH_REQUESTED,
    description: "Request publishing of approved draft",
    requiresHumanAction: false,
  },

  [EventTypes.CONTENT_PUBLISH_REQUESTED]: {
    nextEvent: null,
    description: "Publisher will handle publication",
    requiresHumanAction: false,
  },

  [EventTypes.CONTENT_PUBLISHED]: {
    nextEvent: null,
    description: "Content successfully published — pipeline complete",
    requiresHumanAction: false,
  },

  [EventTypes.CONTENT_PUBLISH_FAILED]: {
    nextEvent: EventTypes.CONTENT_PUBLISH_REQUESTED,
    description: "Retry publishing after failure",
    requiresHumanAction: false,
  },
};

// ─── Payload Builder ─────────────────────────────────────────────────

/**
 * Given an incoming event and a next event type, this builds the
 * appropriate payload for the next event by extracting data from the incoming event.
 */
export function buildPayloadForNextEvent(incomingEvent: AtlasEvent, nextEventType: EventType): any {
  const p = incomingEvent.payload as any;

  switch (nextEventType) {
    case EventTypes.CONTENT_DRAFT_REQUESTED:
      return { contentItemId: p.contentItemId };

    case EventTypes.CONTENT_REVIEW_REQUESTED:
      return { contentItemId: p.contentItemId, draftIds: p.draftIds || [] };

    case EventTypes.CONTENT_PUBLISH_REQUESTED:
      return { draftId: p.draftId || (p.draftIds ? p.draftIds[0] : null), platform: p.platform };

    default:
      return {};
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Given an event type, return the next workflow action.
 *
 * This is the core routing function of the orchestrator.
 * It never performs domain work — it only decides what happens next.
 */
export function getNextAction(eventType: EventType): WorkflowAction {
  const action = workflowMap[eventType];

  if (!action) {
    return {
      nextEvent: null,
      description: `Unknown event type: ${eventType}`,
      requiresHumanAction: false,
    };
  }

  return action;
}
