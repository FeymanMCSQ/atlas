# Prompt System

The prompt system is responsible for transforming signals into high-quality
content drafts.

It lives primarily inside the `content-brain` service.

Prompt logic must remain centralized and structured.

---

# Prompt Pipeline

The prompt system uses a multi-stage pipeline.

Each stage performs a specific transformation.

Stages:

1. Signal extraction
2. Insight framing
3. Hook generation
4. Draft writing
5. Quality critique
6. Rewrite (if needed)

Each stage produces structured output.

---

# Stage 1: Signal Extraction

Purpose:

Convert raw input into structured insights.

Inputs:

- feed article
- transcript
- manual idea

Outputs:


core_claim
key_insight
topic_tags
target_audience
stakes


This stage ensures the AI understands the content.

---

# Stage 2: Insight Framing

Purpose:

Convert extracted signals into a narrative angle.

The AI selects one narrative structure such as:

- hidden mistake
- misconception
- unexpected consequence
- builder lesson
- trend reinterpretation

Outputs:


narrative_angle
key_contrast
reader_takeaway


---

# Stage 3: Hook Generation

Purpose:

Generate attention-grabbing opening lines.

Hooks must follow one of these patterns:

- expectation flip
- hidden cost
- mistaken belief
- unexpected consequence
- short narrative

Hooks must be:

- concise
- clear
- intriguing

---

# Stage 4: Draft Generation

Purpose:

Generate platform-specific content.

Outputs:


x_post
linkedin_post


Guidelines:

- one idea per post
- short paragraphs
- no generic filler
- clear narrative structure

---

# Stage 5: Quality Critique

The system evaluates the draft.

Checks include:

- generic phrasing
- weak hooks
- lack of tension
- lack of clear insight
- excessive length

If quality fails threshold, rewrite is triggered.

---

# Prompt Versioning

Prompts must be versioned.

Each AI run records:


prompt_version
model_used
input_data
output_data


This enables evaluation and improvement.

---

# Prompt Design Principles

Prompts should be:

- deterministic when possible
- structured
- explicit about output format
- constrained to reduce hallucinations

Avoid vague instructions such as:

"write something engaging"

Instead specify narrative patterns and constraints.

---

# Prompt Storage

All prompts live in:


packages/prompts


Prompts should not be embedded inside application code.