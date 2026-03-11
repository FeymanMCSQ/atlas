# Data Model

This document defines the canonical entities used by the system.

All services must conform to this schema.

---

# Core Entities

## ContentItem

Represents a normalized piece of input content.

Sources may include:

- feed articles
- transcripts
- manual notes

Fields:


id
sourceType (feed | transcript | manual)
sourceReference
rawInput
normalizedSummary
topicTags
createdAt


---

## Draft

Represents generated content derived from a ContentItem.

Fields:


id
contentItemId
platform (x | linkedin)
hook
body
status
qualityScore
createdAt


Status values:


generated
review_requested
approved
rejected
published


---

## Publication

Represents a post published to a platform.

Fields:


id
draftId
platform
externalPostId
publishedAt
status


Status values:


success
failed
retrying


---

## FeedSource

Represents a registered external content source.

Fields:


id
name
url
type (rss | newsletter)
active
lastFetchedAt


---

## Transcript

Represents audio-derived content.

Fields:


id
audioFileReference
transcriptText
confidence
createdAt


---

## PromptRun

Represents an AI execution used for content generation.

Fields:


id
promptVersion
inputData
outputData
model
createdAt


Used for debugging and evaluation.

---

# Relationships


FeedSource → ContentItem
Transcript → ContentItem
ContentItem → Draft
Draft → Publication
Draft → PromptRun


---

# Data Invariants

The system enforces the following rules:

- raw source input is immutable
- each draft must reference a content item
- only approved drafts may be published
- each publication must reference a draft
- publication history must never be deleted