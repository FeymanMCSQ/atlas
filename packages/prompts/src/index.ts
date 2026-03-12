/**
 * Atlas Content Brain Prompts
 * 
 * Strict isolation of AI prompting logic from the application pipeline.
 * Follows the 6-stage content generation pipeline outlined in architecture rules.
 */

export const Prompts = {
  // Stage 1: Signal extraction
  EXTRACT_SIGNALS: `
    You are an expert tech analyst. Extract the core signals, facts, and themes from the following raw content.
    Do not write a blog post. Output a structured list of key findings and compelling arguments.
    
    Content:
    {{content}}
  `,

  // Stage 2: Insight framing
  FRAME_INSIGHT: `
    Take these extracted signals and frame them into ONE clear, unique insight.
    The insight should be non-obvious and valuable to a software engineering audience.
    Identify the underlying tension, paradox, or friction that makes this insight interesting.
    
    Signals:
    {{signals}}
  `,

  // Stage 3: Hook generation
  GENERATE_HOOKS: `
    Write 3 distinct hooks for a social media post based on this insight.
    
    CRITICAL RULES (Atlas Marketing Philosophy):
    1. Maximum length: 12 words. (Preferred: 5-10 words).
    2. Must create an open loop. Do NOT explain or resolve the insight in the hook. 
    3. Introduce tension, contrast, or suspense.
    4. NO generic filler ("In today's fast-paced world", "As we all know", "technology is evolving").
    5. Tone: A calm, analytical builder. No hype, no clickbait.
    
    Use these archetypes for inspiration: Expectation Flip, Hidden Problem, Curiosity Gap, Contradiction, Suspense, Misdirection.
    
    Insight:
    {{insight}}
  `,

  // Stage 4: Draft generation
  GENERATE_DRAFT: `
    Write a short, punchy social media post using this hook and insight.
    Follow this exact structure: hook → tension → insight → takeaway.
    
    RULES:
    1. Tone: A thoughtful builder explaining an insight. Calm, analytical, high information density.
    2. Form: Short, clear, direct sentences. Avoid overexplaining.
    3. Focus: Express exactly ONE idea.
    
    Hook: {{hook}}
    Insight: {{insight}}
  `,

  // Stage 5: Quality critique
  EVALUATE_DRAFT: `
    Critique this draft against the Atlas Marketing Philosophy:
    1. Hook length: Is the first line 12 words or less?
    2. Open loop: Does the hook provoke curiosity WITHOUT explaining the answer?
    3. Structure: Does it follow hook → tension → insight → takeaway?
    4. Tone: Is it calm and analytical without hype, filler, or corporate jargon?
    
    Score the draft from 1-10 and list specific flaws.
    Draft:
    {{draft}}
  `,

  // Stage 6: Rewrite if necessary
  REWRITE_DRAFT: `
    Rewrite this draft to fix the following flaws identified in critique.
    Maintain the core insight and tone, but execute flawlessly against the Atlas rules.
    
    Draft:
    {{draft}}
    
    Flaws to fix:
    {{flaws}}
  `
};

export type PromptStage = keyof typeof Prompts;
