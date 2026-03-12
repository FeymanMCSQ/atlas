import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { Prompts } from "./index";
import { db } from "@atlas/db";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../../.env") });

export const DraftSchema = z.object({
  x_post: z.string().describe("The draft formatted for X/Twitter. Must strictly adhere to the hook, tension, insight, takeaway structure and be punchy."),
  linkedin_post: z.string().describe("The draft formatted for LinkedIn. Strictly adheres to the same structure but slightly expanded formatting without any corporate fluff."),
});

async function runTest() {
  console.log("Testing Draft Post Generator...");

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    console.warn("⚠️ OPENROUTER_API_KEY not found in environment. Exiting test.");
    process.exit(1);
  }

  const provider = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: openrouterKey });
  const modelName = 'google/gemini-3-flash-preview';

  // 1. Fetch the latest framed insight
  const lastInsightRun = await db.promptRun.findFirst({
    where: { promptName: "FRAME_INSIGHT" },
    orderBy: { createdAt: "desc" },
  });

  // 2. Fetch the latest generated hooks
  const lastHooksRun = await db.promptRun.findFirst({
    where: { promptName: "GENERATE_HOOKS" },
    orderBy: { createdAt: "desc" },
  });

  if (!lastInsightRun || !lastInsightRun.output || !lastHooksRun || !lastHooksRun.output) {
    console.error("❌ Required prior runs not found. Please run test-narrative.ts and test-hooks.ts first.");
    process.exit(1);
  }

  const insightData = lastInsightRun.output as { insight: string; tension: string; takeaway: string };
  const hooksData = lastHooksRun.output as { hooks: string[] };
  
  const insightText = insightData.insight;
  const selectedHook = hooksData.hooks[0]; // pick the first hook
  
  console.log(`\nGenerating drafts for hook: "${selectedHook}"`);

  const renderedPrompt = Prompts.GENERATE_DRAFT
    .replace("{{hook}}", selectedHook)
    .replace("{{insight}}", insightText);

  try {
    const { object } = await generateObject({
      model: provider(modelName),
      schema: DraftSchema,
      prompt: renderedPrompt,
    });

    console.log("\n✅ Generated Drafts:");
    console.log("--- X (Twitter) ---");
    console.log(object.x_post);
    console.log("\n--- LinkedIn ---");
    console.log(object.linkedin_post);

    // Store the prompt run record in the database
    const promptRun = await db.promptRun.create({
      data: {
        promptName: "GENERATE_DRAFT",
        model: modelName,
        input: { prompt: renderedPrompt, insightId: lastInsightRun.id, hookId: lastHooksRun.id },
        output: object as any,
      }
    });

    console.log(`\n✅ Saved PromptRun to database (${promptRun.id})`);
  } catch (error) {
    console.error("❌ Failed to generate drafts:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTest();
}
