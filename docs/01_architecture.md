# System Architecture

## Overview

The system is built as a **monorepo containing multiple independent apps**
coordinated by a central orchestrator.

Each app owns a specific domain responsibility and communicates through
events and shared data models.

This architecture prioritizes:

- clear service boundaries
- modular development
- replaceable components
- simple scaling

---

## Monorepo Structure


repo/
apps/
transcriber/
feed-ingestor/
content-brain/
publisher/
orchestrator/

packages/
domain/
db/
queue/
integrations/
prompts/
config/
observability/

docs/


---

## Core Applications

### Transcriber

Responsibility:

Convert recorded audio into structured transcript content.

Functions:

- accept audio inputs
- call transcription service
- normalize transcript
- create transcript content records

Outputs:

- `content.transcribed` events

---

### Feed Ingestor

Responsibility:

Fetch and normalize external signals from content feeds.

Functions:

- RSS ingestion
- deduplication
- metadata extraction
- source tracking

Outputs:

- `content.ingested` events

---

### Content Brain

Responsibility:

Transform signals into narrative content drafts.

Functions:

- topic classification
- insight extraction
- hook generation
- narrative framing
- draft generation
- quality evaluation

Outputs:

- `content.drafted` events

---

### Publisher

Responsibility:

Publish approved content to external platforms.

Functions:

- X publishing
- LinkedIn publishing
- rate limit handling
- retry logic
- publication logging

Outputs:

- `content.published`
- `content.publish_failed`

---

### Orchestrator

Responsibility:

Coordinate system workflows and manage job sequencing.

Functions:

- workflow orchestration
- event handling
- scheduling
- approval logic
- fallback posting rules
- dashboard API

The orchestrator **does not perform domain work**.
It only coordinates other services.

---

## Communication Model

Services communicate using:

- shared database records
- queue-based events

No service directly depends on another service’s internal logic.

---

## Core Pipeline


Feed/Transcript Input
↓
Signal Ingestion
↓
Content Processing
↓
Draft Generation
↓
Human Review
↓
Publish Request
↓
Platform Publication


---

## Shared Packages

### `domain`

Shared schemas and types.

### `db`

Database client and repositories.

### `queue`

Job queue abstraction.

### `integrations`

External APIs and adapters.

### `prompts`

Prompt templates and AI logic.

### `config`

Environment configuration management.

---

## Scaling Model

The system scales by increasing worker capacity for:

- feed ingestion
- content generation
- publishing

Workers can run independently across machines if required.

The orchestrator remains lightweight and stateless.