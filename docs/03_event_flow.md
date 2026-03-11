# Event Flow

This document defines the system's event-driven workflow.

Events allow services to operate independently while coordinating work.

---

# Event Model

Each event contains:

eventId
eventType
timestamp
payload


Events are published through the system queue.

---

# Core Events

## content.ingested

Emitted by:

Feed Ingestor

Triggered when:

A new feed item has been normalized and stored.

Payload:


contentItemId
source
timestamp


---

## content.transcribed

Emitted by:

Transcriber

Triggered when:

An audio recording has been converted into text.

Payload:


contentItemId
transcriptId
timestamp


---

## content.scored

Emitted by:

Content Brain

Triggered when:

Content relevance and topic analysis has completed.

Payload:


contentItemId
score
tags


---

## content.drafted

Emitted by:

Content Brain

Triggered when:

AI-generated drafts are produced.

Payload:


contentItemId
draftIds
platforms


---

## content.review_requested

Emitted by:

Orchestrator

Triggered when:

Drafts are ready for human review.

Payload:


draftIds
contentItemId


---

## content.approved

Emitted by:

Orchestrator

Triggered when:

A draft passes review.

Payload:


draftId
platform


---

## content.publish_requested

Emitted by:

Orchestrator

Triggered when:

A draft should be published.

Payload:


draftId
platform


---

## content.published

Emitted by:

Publisher

Triggered when:

A post has successfully been published.

Payload:


draftId
platform
externalPostId


---

## content.publish_failed

Emitted by:

Publisher

Triggered when:

Publishing fails.

Payload:


draftId
platform
error


---

# Workflow Example

Example lifecycle:


content.ingested
↓
content.scored
↓
content.drafted
↓
content.review_requested
↓
content.approved
↓
content.publish_requested
↓
content.published


---

# Failure Handling

If publishing fails:


content.publish_failed


The orchestrator may:

- retry publishing
- move item to manual review
- log failure for analysis

---

# Event Design Principles

Events must be:

- immutable
- idempotent
- traceable
- minimal
- versioned when necessary