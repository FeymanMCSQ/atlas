import { NextResponse } from 'next/server';
import { db } from '@atlas/db';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const provider = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});

// User requested the best model for this intellectually taxing task.
const RESONANCE_MODEL = 'anthropic/claude-opus-4.6'; 

const TemplateSchema = z.object({
  name: z.string().describe("A catchy, memorable name for this format (e.g. 'The Confrontational Numbered List')"),
  hookArchetype: z.string().describe("What psychological trigger is the first line pulling? (e.g. 'Stating a contrarian truth to build tension')"),
  formatStructure: z.string().describe("The exact structural rhythm used (e.g. '1 short sentence. Break. 3 bullet points. 1 concluding command.')"),
  pacing: z.string().describe("The tone and speed of the text. (e.g. 'Fast, aggressive, zero fluff.')"),
  examples: z.string().describe("Include 1 or 2 reconstructed placeholder examples of how to mimic this structure.")
});

export async function POST(request: Request) {
  try {
    const { viralPostText } = await request.json();

    if (!viralPostText || viralPostText.length < 20) {
      return NextResponse.json({ error: 'Text too short.' }, { status: 400 });
    }

    console.log(`[Resonance Engine] Initiating Claude-3-Opus deconstruction on viral post...`);

    const { object: templateData } = await generateObject({
      model: provider(RESONANCE_MODEL),
      schema: TemplateSchema,
      prompt: `
        You are an elite, highly-paid social media copywriter and marketing psychologist for B2B tech founders.
        Your job is to reverse-engineer viral LinkedIn/X posts into reusable abstract templates.
        
        Analyze the following viral post. Ignore the actual specific topic being discussed. I ONLY care about the abstract formatting, the hook psychology, the cadence, and the structural rhythm.
        
        Viral Post:
        """
        ${viralPostText}
        """
        
        Extract the deep marketing framework behind this post so that a different AI can use this framework to write about completely different topics in the exact same style.
      `
    });

    console.log(`[Resonance Engine] Extraction successful. Saving template -> ${templateData.name}`);

    // Save to Postgres
    const template = await db.postTemplate.create({
      data: {
        name: templateData.name,
        hookArchetype: templateData.hookArchetype,
        formatStructure: templateData.formatStructure,
        pacing: templateData.pacing,
        examples: templateData.examples
      }
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    console.error(`[Resonance Engine] Fatal Error:`, error.message || error);
    return NextResponse.json({ error: 'Failed to reverse engineer post.' }, { status: 500 });
  }
}
