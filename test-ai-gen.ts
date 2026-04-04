import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { InformationPrompts as Prompts } from "./packages/prompts/src/index";

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

async function testGeneration() {
  const rawContent = "Google Research AI released a new study detailing how machine learning is improving breast cancer screening workflows. By integrating AI models into clinical settings, the software helps detect anomalies with greater accuracy and reduces false positives by 11.5%. The AI system essentially acts as a highly accurate second reader. This shift means medical workflows are becoming more reliant on cognitive software rather than just data storage systems. Implementing this AI software reduces workload for radiologists by 15%.";

  console.log("Raw Content:", rawContent);

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
}

testGeneration().catch(console.error);
