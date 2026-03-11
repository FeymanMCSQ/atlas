# Operations

This document describes how the system runs in production.

It covers deployment, configuration, monitoring, and failure recovery.

---

# Environments

The system runs in three environments:


development
staging
production


Each environment has separate:

- database
- queue
- credentials

---

# Deployment Model

Each application runs as an independent service.

Services:


transcriber
feed-ingestor
content-brain
publisher
orchestrator


Workers may be scaled independently.

---

# Scheduling

Scheduled jobs include:

Feed ingestion polling
Daily auto-post fallback
Queue cleanup
Retry handling

Schedulers are owned by the orchestrator.

---

# Configuration

Configuration is provided through environment variables.

Examples:


DATABASE_URL
QUEUE_URL
OPENAI_API_KEY
X_API_KEY
LINKEDIN_API_KEY


Configuration must be validated at startup.

---

# Logging

All services must produce structured logs.

Each log entry should include:

- service name
- request or job id
- content item id
- timestamp
- log level

---

# Monitoring

Key metrics include:

- feed ingestion success rate
- draft generation latency
- publish success rate
- retry frequency

These metrics help detect failures early.

---

# Failure Handling

Failures fall into three categories:

Integration failures
Processing failures
Publishing failures

Common strategies:

- retry with backoff
- dead-letter queue
- manual review

---

# Secrets Management

Secrets must never be stored in the repository.

Secrets must be stored in a secure environment variable manager.

Examples:

- cloud secret manager
- environment configuration

---

# Disaster Recovery

Critical data is stored in the database.

Database backups should be scheduled regularly.

In case of service failure:

Workers can restart and resume processing because operations are idempotent.