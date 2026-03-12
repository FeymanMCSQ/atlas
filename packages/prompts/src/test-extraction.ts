import { z } from "zod";
import { generateObject } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { Prompts } from "./index";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../../.env") });

export const SignalExtractionSchema = z.object({
  signals: z.array(z.string()).describe("A list of core signals, facts, or data points from the raw content."),
  themes: z.array(z.string()).describe("The overarching themes present in the content."),
  arguments: z.array(z.string()).describe("The compelling arguments or opinions presented by the author."),
});

async function runTest() {
  console.log("Testing Signal Extraction Prompt...");
  
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!openaiKey && !openrouterKey) {
    console.warn("⚠️  No API key found in environment. Exiting test.");
    console.warn("Please add OPENAI_API_KEY or OPENROUTER_API_KEY to your root .env file to run this test.");
    process.exit(1);
  }

  // Support either OpenAI native or OpenRouter (from KI patterns)
  const provider = openrouterKey 
    ? createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: openrouterKey })
    : openai;
    
  const modelName = openrouterKey ? 'google/gemini-2.5-flash' : 'gpt-4o-mini';

  const rawContent = `
    Apple is reportedly working on a foldable iPhone, potentially releasing it as early as 2026. 
    However, executives are concerned about the durability of the folding screen, especially the crease 
    that forms down the middle. Unlike Samsung, Apple wants the display to be completely flat when open. 
    If they can't solve the crease issue, they might cancel the project entirely.
  `;

  try {
    const { object } = await generateObject({
      model: provider(modelName),
      schema: SignalExtractionSchema,
      prompt: Prompts.EXTRACT_SIGNALS.replace("{{content}}", rawContent),
    });

    console.log("\n✅ Structured Insight JSON:");
    console.log(JSON.stringify(object, null, 2));
  } catch (error) {
    console.error("❌ Failed to extract signals:", error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runTest();
}
