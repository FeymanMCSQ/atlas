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
    
    Signals:
    {{signals}}
  `,

  // Stage 3: Hook generation
  GENERATE_HOOKS: `
    Write 3 distinct hooks for a social media post based on this insight.
    Rule 1: Every hook must create curiosity, tension, or contrast.
    Rule 2: Do not use generic filler language ("In today's fast paced world...").
    
    Insight:
    {{insight}}
  `,

  // Stage 4: Draft generation
  GENERATE_DRAFT: `
    Write a short, punchy social media post using this hook and insight.
    Follow this exact structure: hook → tension → insight → takeaway.
    Prefer short, clear sentences. Express one clear idea.
    
    Hook: {{hook}}
    Insight: {{insight}}
  `,

  // Stage 5: Quality critique
  EVALUATE_DRAFT: `
    Critique this draft against the Atlas Writing Guidelines:
    1. Does it start with a strong hook?
    2. Does it express exactly one clear idea?
    3. Is it free of generic corporate filler language?
    4. Are the sentences short and clear?
    5. Does it follow the structure: hook → tension → insight → takeaway?
    
    Score the draft from 1-10 and list specific flaws.
    Draft:
    {{draft}}
  `,

  // Stage 6: Rewrite if necessary
  REWRITE_DRAFT: `
    Rewrite this draft to fix the following flaws identified in critique.
    Maintain the core insight but improve the execution.
    
    Draft:
    {{draft}}
    
    Flaws to fix:
    {{flaws}}
  `
};

export type PromptStage = keyof typeof Prompts;
