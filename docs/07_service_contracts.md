# Service Contracts

This document defines the responsibilities, inputs, and outputs
of each application in the system.

Services must follow these contracts.

---

# Transcriber

Responsibility:

Convert audio recordings into transcript content.

Inputs:


audio file


Outputs:


content.transcribed event
Transcript record
ContentItem creation


Forbidden:

- generating social posts
- publishing content
- orchestrating workflows

---

# Feed Ingestor

Responsibility:

Collect external signals from content feeds.

Inputs:


feed sources
RSS endpoints


Outputs:


ContentItem
content.ingested event


Forbidden:

- generating AI content
- publishing posts
- modifying drafts

---

# Content Brain

Responsibility:

Generate narrative content drafts.

Inputs:


ContentItem
transcripts


Outputs:


Draft records
content.drafted event


Functions:

- signal extraction
- narrative framing
- hook generation
- draft writing
- quality evaluation

Forbidden:

- publishing posts
- scheduling workflows
- modifying feed sources

---

# Publisher

Responsibility:

Publish approved drafts to platforms.

Inputs:


Draft
publish request


Outputs:


content.published
content.publish_failed


Functions:

- platform formatting
- API calls
- retry logic
- rate limit handling

Forbidden:

- generating drafts
- ingesting signals
- orchestration decisions

---

# Orchestrator

Responsibility:

Coordinate the system workflow.

Inputs:


system events
user approvals
scheduler triggers


Outputs:


workflow events
publish requests
review requests


Functions:

- job scheduling
- workflow sequencing
- approval management
- fallback posting logic

Forbidden:

- AI content generation
- platform publishing
- feed ingestion