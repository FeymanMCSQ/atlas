import { z } from "zod";
import { generateObject } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { Prompts } from "./index";
import { db } from "@atlas/db";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../../.env") });

export const NarrativeInsightSchema = z.object({
  insight: z.string().describe("ONE clear, unique, non-obvious insight derived from the signals."),
  tension: z.string().describe("The underlying paradox, problem, or friction that makes this insight interesting."),
  takeaway: z.string().describe("An actionable lesson or conclusion for a software engineering audience."),
});

async function runTest() {
  console.log("Testing Narrative Angle Generator...");

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    console.warn("⚠️ OPENROUTER_API_KEY not found in environment. Exiting test.");
    process.exit(1);
  }

  const provider = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: openrouterKey });
  const modelName = 'google/gemini-3-flash-preview';

  // 1. Fetch the latest extracted signals from our previous PromptRun
  const lastRun = await db.promptRun.findFirst({
    where: { promptName: "EXTRACT_SIGNALS" },
    orderBy: { createdAt: "desc" },
  });

  if (!lastRun || !lastRun.output) {
    console.error("❌ No EXTRACT_SIGNALS PromptRun found in the database. Please run test-extraction.ts first.");
    process.exit(1);
  }

  const signalsInput = JSON.stringify(lastRun.output, null, 2);
  console.log(`\nAnalyzing signals from run ${lastRun.id}...`);

  const renderedPrompt = Prompts.FRAME_INSIGHT.replace("{{signals}}", signalsInput);

  try {
    const { object } = await generateObject({
      model: provider(modelName),
      schema: NarrativeInsightSchema,
      prompt: renderedPrompt,
    });

    console.log("\n✅ Generated Narrative Structure:");
    console.log(JSON.stringify(object, null, 2));

    // Store the prompt run record in the database
    const promptRun = await db.promptRun.create({
      data: {
        promptName: "FRAME_INSIGHT",
        model: modelName,
        input: { prompt: renderedPrompt, sourceRunId: lastRun.id },
        output: object as any,
      }
    });

    console.log(`\n✅ Saved PromptRun to database (${promptRun.id})`);
  } catch (error) {
    console.error("❌ Failed to frame insight:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTest();
}
