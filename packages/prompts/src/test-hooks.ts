import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { Prompts } from "./index";
import { db } from "@atlas/db";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../../.env") });

export const HooksSchema = z.object({
  hooks: z.array(z.string()).min(3).max(3).describe("Exactly 3 distinct, compelling hooks that create curiosity, tension, or contrast without using generic filler language."),
});

async function runTest() {
  console.log("Testing Hook Generator...");

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    console.warn("⚠️ OPENROUTER_API_KEY not found in environment. Exiting test.");
    process.exit(1);
  }

  const provider = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: openrouterKey });
  const modelName = 'google/gemini-3-flash-preview';

  // Fetch the latest framed insight from our previous PromptRun
  const lastRun = await db.promptRun.findFirst({
    where: { promptName: "FRAME_INSIGHT" },
    orderBy: { createdAt: "desc" },
  });

  if (!lastRun || !lastRun.output) {
    console.error("❌ No FRAME_INSIGHT PromptRun found in the database. Please run test-narrative.ts first.");
    process.exit(1);
  }

  const outputData = lastRun.output as { insight: string; tension: string; takeaway: string };
  const insightText = outputData.insight;
  
  if (!insightText) {
    console.error("❌ The previous FRAME_INSIGHT run did not contain a valid 'insight' string.");
    process.exit(1);
  }

  console.log(`\nGenerating hooks for insight: "${insightText}" (from run ${lastRun.id})...`);

  const renderedPrompt = Prompts.GENERATE_HOOKS.replace("{{insight}}", insightText);

  try {
    const { object } = await generateObject({
      model: provider(modelName),
      schema: HooksSchema,
      prompt: renderedPrompt,
    });

    console.log("\n✅ Generated Hooks:");
    object.hooks.forEach((hook, i) => console.log(`${i + 1}. ${hook}`));

    // Store the prompt run record in the database
    const promptRun = await db.promptRun.create({
      data: {
        promptName: "GENERATE_HOOKS",
        model: modelName,
        input: { prompt: renderedPrompt, sourceRunId: lastRun.id, insightText },
        output: object as any,
      }
    });

    console.log(`\n✅ Saved PromptRun to database (${promptRun.id})`);
  } catch (error) {
    console.error("❌ Failed to generate hooks:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTest();
}
