import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { Prompts } from "./index";
import { db } from "@atlas/db";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { DraftSchema } from "./test-drafts"; // Reusing the same schema

dotenv.config({ path: resolve(__dirname, "../../../.env") });

async function runTest() {
  console.log("Testing Draft Rewriter (Quality Loop)...");

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    console.warn("⚠️ OPENROUTER_API_KEY not found in environment. Exiting test.");
    process.exit(1);
  }

  const provider = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: openrouterKey });
  const modelName = 'google/gemini-3-flash-preview';

  // 1. Fetch the latest Evaluation run
  const lastEvaluationRun = await db.promptRun.findFirst({
    where: { promptName: "EVALUATE_DRAFT" },
    orderBy: { createdAt: "desc" },
  });

  if (!lastEvaluationRun || !lastEvaluationRun.output || !lastEvaluationRun.input) {
    console.error("❌ No EVALUATE_DRAFT PromptRun found in the database. Please run test-evaluation.ts first.");
    process.exit(1);
  }

  const evalData = lastEvaluationRun.output as { score: number; passed: boolean; flaws: string[]; critique: string };
  const inputData = lastEvaluationRun.input as { targetDraft: string };
  
  const targetDraft = inputData.targetDraft;
  const flaws = evalData.flaws;
  
  // Threshold logic: We demand perfection for this test (Score >= 10 and passed === true and no flaws)
  if (evalData.score >= 10 && evalData.passed && flaws.length === 0) {
    console.log("✅ The draft is perfect! No rewrite necessary.");
    process.exit(0);
  }

  console.log(`\n⚠️ Draft scored ${evalData.score}/10. Initiating rewrite to fix the following flaws:`);
  flaws.forEach((flaw, i) => console.log(`  - ${flaw}`));

  const formattedFlaws = flaws.map(f => `- ${f}`).join("\n");
  const renderedPrompt = Prompts.REWRITE_DRAFT
    .replace("{{draft}}", targetDraft)
    .replace("{{flaws}}", formattedFlaws);

  try {
    const { object } = await generateObject({
      model: provider(modelName),
      schema: DraftSchema, // Needs to output the dual x_post / linkedin_post structure
      prompt: renderedPrompt,
    });

    console.log("\n✅ Generated Rewritten Drafts:");
    console.log("--- X (Twitter) ---");
    console.log(object.x_post);
    console.log("\n--- LinkedIn ---");
    console.log(object.linkedin_post);

    // Store the prompt run record in the database
    const promptRun = await db.promptRun.create({
      data: {
        promptName: "REWRITE_DRAFT",
        model: modelName,
        input: { prompt: renderedPrompt, sourceEvalRunId: lastEvaluationRun.id, originalDraft: targetDraft, flaws },
        output: object as any,
      }
    });

    console.log(`\n✅ Saved PromptRun to database (${promptRun.id})`);
  } catch (error) {
    console.error("❌ Failed to rewrite draft:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTest();
}
