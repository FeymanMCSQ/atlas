import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { Prompts } from "./index";
import { db } from "@atlas/db";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../../.env") });

export const EvaluationSchema = z.object({
  score: z.number().min(1).max(10).describe("Overall score out of 10 based on strict adherence to the Atlas Marketing Philosophy."),
  passed: z.boolean().describe("True if the score is 8 or higher and there are zero fatal flaws. False otherwise."),
  flaws: z.array(z.string()).describe("List of specific, actionable flaws violating the rules. Empty array if perfect."),
  critique: z.string().describe("A short explanation of the score and any necessary changes."),
});

async function runTest() {
  console.log("Testing Draft Evaluation (Quality Gate)...");

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    console.warn("⚠️ OPENROUTER_API_KEY not found in environment. Exiting test.");
    process.exit(1);
  }

  const provider = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: openrouterKey });
  const modelName = 'google/gemini-3-flash-preview';

  // 1. Fetch the latest generated draft from the database
  const lastDraftRun = await db.promptRun.findFirst({
    where: { promptName: "GENERATE_DRAFT" },
    orderBy: { createdAt: "desc" },
  });

  if (!lastDraftRun || !lastDraftRun.output) {
    console.error("❌ No GENERATE_DRAFT PromptRun found in the database. Please run test-drafts.ts first.");
    process.exit(1);
  }

  const draftData = lastDraftRun.output as { x_post: string; linkedin_post: string };
  const targetDraft = draftData.linkedin_post; // We'll evaluate the LinkedIn post
  
  console.log(`\nEvaluating Draft from run ${lastDraftRun.id}:\n"${targetDraft}"`);

  const renderedPrompt = Prompts.EVALUATE_DRAFT.replace("{{draft}}", targetDraft);

  try {
    const { object } = await generateObject({
      model: provider(modelName),
      schema: EvaluationSchema,
      prompt: renderedPrompt,
    });

    console.log(`\n✅ Evaluation Complete! Passed: ${object.passed} (Score: ${object.score}/10)`);
    console.log(`Critique: ${object.critique}`);
    if (object.flaws.length > 0) {
      console.log(`Flaws found:`);
      object.flaws.forEach((flaw, i) => console.log(`  - ${flaw}`));
    } else {
      console.log(`Flaws found: None! Perfect draft.`);
    }

    // Store the prompt run record in the database
    const promptRun = await db.promptRun.create({
      data: {
        promptName: "EVALUATE_DRAFT",
        model: modelName,
        input: { prompt: renderedPrompt, sourceDraftRunId: lastDraftRun.id, targetDraft },
        output: object as any,
      }
    });

    console.log(`\n✅ Saved PromptRun to database (${promptRun.id})`);
  } catch (error) {
    console.error("❌ Failed to evaluate draft:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTest();
}
