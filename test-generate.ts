import { db } from './packages/db/src/index';

import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env") });

const provider = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});

const MODEL_NAME = 'google/gemini-3-flash-preview';

const ExtractSchema = z.object({
  signals: z.array(z.string()).describe("A structured list of facts, themes, and key findings.")
});

const FrameSchema = z.object({
  insight: z.string().describe("The core, non-obvious insight framing everything."),
  tension: z.string().describe("The paradox, friction, or underlying tension driving the insight."),
  takeaway: z.string().describe("What the audience should walk away with at the end.")
});

const HooksSchema = z.object({
  hooks: z.array(z.string()).describe("A list of 3 distinct, high-tension hooks under 12 words.")
});

const DraftSchema = z.object({
  x_post: z.string().describe("The draft formatted natively for X (Twitter). Punchy, hook->tension->insight->takeaway."),
  linkedin_post: z.string().describe("The draft formatted natively for LinkedIn. Expanding slightly on X formatting without using filler.")
});

// Use prompts directly
const Prompts = {
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
    Write two versions of a social media post using this hook and insight: one for X (Twitter) and one for LinkedIn.
    Follow this exact structure: hook → tension → insight → takeaway.
    
    RULES:
    1. Tone: A thoughtful builder explaining an insight. Calm, analytical, high information density.
    2. Form: Short, clear, direct sentences. Avoid overexplaining.
    3. Focus: Express exactly ONE idea.
    4. X (Twitter): Extremely punchy.
    5. LinkedIn: Slightly more room for formatting and spacing, but strictly NO corporate filler. Keep it sharp.
    
    Hook: {{hook}}
    Insight: {{insight}}
  `
};

async function testGeneration() {
  const item = await db.contentItem.findFirst({
    where: { summary: { not: '' } }
  });

  if (!item) {
    console.log("No content item found.");
    process.exit(1);
  }

  console.log("Testing on Item Title:", item.title);
  
  const rawContent = item.summary;

  console.log("\n[1] Extracting Signals...");
  const { object: signalsObj } = await generateObject({
    model: provider(MODEL_NAME),
    schema: ExtractSchema,
    prompt: Prompts.EXTRACT_SIGNALS.replace('{{content}}', rawContent),
  });
  console.log("Signals:", signalsObj.signals);

  console.log("\n[2] Framing Insight...");
  const { object: frameObj } = await generateObject({
    model: provider(MODEL_NAME),
    schema: FrameSchema,
    prompt: Prompts.FRAME_INSIGHT.replace('{{signals}}', signalsObj.signals.join('\\n')),
  });
  console.log("Insight:", frameObj);

  console.log("\n[3] Generating Hooks...");
  const { object: hooksObj } = await generateObject({
    model: provider(MODEL_NAME),
    schema: HooksSchema,
    prompt: Prompts.GENERATE_HOOKS.replace('{{insight}}', frameObj.insight),
  });
  console.log("Hooks:", hooksObj.hooks);

  console.log("\n[4] Generating Drafts...");
  const { object: initialDraft } = await generateObject({
    model: provider(MODEL_NAME),
    schema: DraftSchema,
    prompt: Prompts.GENERATE_DRAFT
      .replace('{{hook}}', hooksObj.hooks[0])
      .replace('{{insight}}', frameObj.insight),
  });
  console.log("\n--- X POST ---");
  console.log(initialDraft.x_post);
  console.log("\n--- LINKEDIN POST ---");
  console.log(initialDraft.linkedin_post);
  
  process.exit(0);
}

testGeneration();
