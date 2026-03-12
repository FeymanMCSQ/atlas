Atlas Development Campaign
Stage 1 — Atlas Core (Orchestrator)

The conductor of the machine. Nothing else works if this skeleton is missing.

Level 1 — Repo Genesis

Quest 1: Create Monorepo Skeleton
XP: 80
Win condition: Repo contains /apps, /packages, /docs folders and commits successfully.

Quest 2: Initialize Workspace Tooling
XP: 60
Win condition: pnpm install (or chosen workspace tool) runs and installs dependencies across apps.

Quest 3: Create Orchestrator App
XP: 60
Win condition: apps/orchestrator starts and logs “Atlas orchestrator online”.

Level 2 — Event Infrastructure

Quest 1: Define Event Types
XP: 80
Win condition: Event schema file exports all events (content.ingested, etc.).

Quest 2: Install Queue System
XP: 80
Win condition: Redis/queue connection works and can enqueue a test event.

Quest 3: Event Logger Worker
XP: 60
Win condition: Orchestrator logs received events from queue.

Level 3 — Workflow Engine

Quest 1: Draft Workflow Skeleton
XP: 80
Win condition: Function exists mapping events → next step.

Quest 2: Implement Ingest → Draft Workflow
XP: 100
Win condition: content.ingested triggers draft request event.

Quest 3: Implement Draft → Publish Workflow
XP: 100
Win condition: content.approved triggers publish request event.

Stage 2 — Feed Ingestor

The radar scanning the outside world.

Level 1 — Feed Detection

Quest 1: RSS Parser Setup
XP: 70
Win condition: Parser successfully reads a test RSS feed.

Quest 2: Extract Article Metadata
XP: 70
Win condition: Title, URL, summary extracted into JSON.

Quest 3: Store FeedSource Records
XP: 60
Win condition: Feed source saved in database.

Level 2 — Content Item Creation

Quest 1: Create ContentItem Schema
XP: 80
Win condition: DB migration runs successfully.

Quest 2: Convert Feed Item → ContentItem
XP: 80
Win condition: Feed article becomes stored ContentItem.

Quest 3: Deduplication Check
XP: 90
Win condition: Duplicate feed URLs are rejected.

Level 3 — Event Emission

Quest 1: Emit content.ingested Event
XP: 80
Win condition: Queue receives event after ingestion.

Quest 2: Connect Feed Ingestor → Orchestrator
XP: 100
Win condition: Orchestrator logs ingestion event.

Stage 3 — Content Brain

The thinking engine. Raw signals become ideas.

Level 1 — Prompt Engine

Quest 1: Create Prompt Package
XP: 70
Win condition: /packages/prompts exports prompt templates.

Quest 2: Implement Signal Extraction Prompt
XP: 90
Win condition: Raw content returns structured insight JSON.

Quest 3: Store PromptRun Records
XP: 60
Win condition: Prompt input/output stored in database.

Level 2 — Narrative Engine

Quest 1: Implement Narrative Angle Generator
XP: 80
Win condition: System returns narrative structure.

Quest 2: Implement Hook Generator
XP: 100
Win condition: AI generates 3 hook options.

Quest 3: Draft Post Generator
XP: 100
Win condition: Draft text generated for X and LinkedIn.

Level 3 — Quality Gate

Quest 1: Implement Draft Evaluation
XP: 90
Win condition: Draft scored by rule checks.

Quest 2: Rewrite If Low Quality
XP: 100
Win condition: System regenerates draft if score below threshold.

Stage 4 — Publisher

The outward-facing machine.

Level 1 — Platform Integrations

Quest 1: X API Client Setup
XP: 80
Win condition: Test post successfully sent to dev account.

Quest 2: LinkedIn API Client Setup
XP: 80
Win condition: LinkedIn draft post created.

Level 2 — Publishing Engine

Quest 1: Draft → Platform Formatter
XP: 70
Win condition: Draft converted into platform payload.

Quest 2: Publish Handler
XP: 90
Win condition: content.publish_requested triggers API post.

Level 3 — Safety Layer

Quest 1: Retry Logic
XP: 80
Win condition: Failed publish retries automatically.

Quest 2: Duplicate Protection
XP: 100
Win condition: Same draft cannot publish twice.

Stage 5 — Transcriber

The thought-capture engine.

Level 1 — Audio Intake

Quest 1: Audio Upload Endpoint
XP: 70
Win condition: Audio file stored locally or cloud.

Quest 2: Transcription API Integration
XP: 90
Win condition: Audio converts to text transcript.

Level 2 — Transcript Processing

Quest 1: Clean Transcript Text
XP: 70
Win condition: Remove filler and timestamps.

Quest 2: Convert Transcript → ContentItem
XP: 80
Win condition: Transcript stored as signal.

Level 3 — Event Integration

Quest 1: Emit content.transcribed Event
XP: 80
Win condition: Event visible in orchestrator logs.

Quest 2: Full Transcript Pipeline Test
XP: 120
Win condition: Voice note → draft post generated.

Final Boss Quest — Atlas Awakens

XP: 300

Win condition:

Feed article OR voice note
→ ContentItem created
→ Draft generated
→ Approved
→ Published to platform

Entire pipeline executes without manual intervention.

XP Progression

Rough total:

Stage 1: ~620 XP
Stage 2: ~550 XP
Stage 3: ~690 XP
Stage 4: ~500 XP
Stage 5: ~510 XP

Total: ~2870 XP