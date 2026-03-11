# Atlas

Automated content pipeline for technical thought leadership.

```
signals → insights → drafts → approved posts → published content
```

## Architecture

Atlas is a monorepo containing independent services coordinated by a central orchestrator.

### Apps

| Service | Responsibility |
|---|---|
| `transcriber` | Converts audio recordings into transcript content |
| `feed-ingestor` | Fetches and normalizes external signals from content feeds |
| `content-brain` | Transforms signals into narrative content drafts using AI |
| `publisher` | Publishes approved content to X and LinkedIn |
| `orchestrator` | Coordinates system workflows and job sequencing |

### Packages

| Package | Purpose |
|---|---|
| `domain` | Shared schemas and types |
| `db` | Database client and repositories |
| `queue` | Job queue abstraction |
| `integrations` | External API adapters |
| `prompts` | AI prompt templates |
| `config` | Environment configuration |
| `observability` | Structured logging and metrics |

## Documentation

See [`/docs`](./docs) for full system documentation.
