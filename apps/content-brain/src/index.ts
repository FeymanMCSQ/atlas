import { createEventWorker, emitEvent } from "@atlas/queue";
import { EventTypes, AtlasEvent, ContentDraftRequestedPayload } from "@atlas/domain";
import { db } from "@atlas/db";
import { FounderPrompts, InformationPrompts } from "@atlas/prompts";
import { searchGoogleImages } from "@atlas/integrations/src/serper-client.js";
import { generateImageWithFlux } from "@atlas/integrations/src/fal-client.js";

import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../../.env") });

const provider = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});

// We use the flash preview model as default fallback
const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

/**
 * Zod schemas representing the strictly bounded outputs required for each
 * stage of the AI pipeline sequence.
 */
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

const EvalSchema = z.object({
  score: z.number().describe("A strict numerical score from 1 to 10 reflecting how closely the draft aligns with Atlas guidelines."),
  flaws: z.array(z.string()).describe("A list of explicit flaws referencing the negative tone/structure traits.")
});

const ImageHeadlineSchema = z.object({
  headline: z.string().describe("A hyper-condensed 4 to 7 word news headline representing the core insight.")
});

/**
 * AI Generation Pipeline orchestrator logic.
 */
async function processDraftPipeline(payload: ContentDraftRequestedPayload) {
  const startTime = Date.now();
  const timestamp = new Array(20).fill('-').join('');
  
  console.log(`\n${timestamp}`);
  console.log(`[Content Brain] ⚡ STARTING PIPELINE for Item: ${payload.contentItemId}`);
  console.log(`[Content Brain] Model requested: ${payload.model || DEFAULT_MODEL}`);
  console.log(`${timestamp}\n`);

  try {
    console.log(`[Content Brain] [DB] Fetching ContentItem...`);
    const item = await db.contentItem.findUnique({ where: { id: payload.contentItemId } });
    
    if (!item) {
      console.error(`[Content Brain] ❌ ContentItem ${payload.contentItemId} not found in database.`);
      return;
    }
    console.log(`[Content Brain] [DB] Found Item: "${item.title}" (Mode: ${item.mode}, Source: ${item.source})`);

    let rawContent = '';

    if (item.source === 'transcript') {
      console.log(`[Content Brain] Source is transcript. Fetching transcript text...`);
      const data = item.sourceData as any;
      if (data && data.transcriptId) {
        const transcript = await db.transcript.findUnique({ where: { id: data.transcriptId } });
        rawContent = transcript?.transcriptText || '';
      }
    } else {
      console.log(`[Content Brain] Source is non-transcript. Using summary/data...`);
      rawContent = item.summary || JSON.stringify(item.sourceData);

      if (item.url && item.url.startsWith('http')) {
        console.log(`[Content Brain] 🕸️ URL found. Invoking Deep Scraper via Jina Reader: ${item.url}`);
        const scrapeStart = Date.now();
        try {
          const jinaRes = await fetch(`https://r.jina.ai/${item.url}`, {
            signal: AbortSignal.timeout(15000)
          });
          if (jinaRes.ok) {
             const deepMarkdown = await jinaRes.text();
             if (deepMarkdown && deepMarkdown.length > 50) {
               rawContent = deepMarkdown.substring(0, 8000); 
               console.log(`[Content Brain] ✅ Deep Scrape successful (${Date.now() - scrapeStart}ms): ${rawContent.length} chars acquired.`);
             } else {
               console.log(`[Content Brain] ⚠️ Deep Scrape returned blank markdown (took ${Date.now() - scrapeStart}ms).`);
             }
          } else {
             console.log(`[Content Brain] ⚠️ Deep Scrape blocked or failed (HTTP ${jinaRes.status}, took ${Date.now() - scrapeStart}ms).`);
          }
        } catch (e: any) {
           console.warn(`[Content Brain] ⚠️ Deep Scrape timeout/failure after ${Date.now() - scrapeStart}ms: ${e.message}.`);
        }
      }
    }

    if (!rawContent || rawContent.trim() === '') {
      console.log(`[Content Brain] ❌ Extracted text is empty. ABORTING.`);
      return;
    }

    const Prompts = item.mode === 'FOUNDER' ? FounderPrompts : InformationPrompts;
    const targetModel = payload.model || DEFAULT_MODEL;

    // --- STAGE 1: EXTRACT ---
    const { object: signalsObj } = await generateObject({
      model: provider(targetModel),
      schema: ExtractSchema,
      prompt: Prompts.EXTRACT_SIGNALS
          .replace('{{title}}', item.title)
          .replace('{{content}}', rawContent),
    });
    console.log(`[Content Brain] ✅ Stage 1 Done. Found ${signalsObj.signals.length} signals.`);

    // --- STAGE 2: FRAME ---
    const { object: frameObj } = await generateObject({
      model: provider(targetModel),
      schema: FrameSchema,
      prompt: Prompts.FRAME_INSIGHT.replace('{{signals}}', signalsObj.signals.join('\n')),
    });
    console.log(`[Content Brain] ✅ Stage 2 Done.`);

    // --- STAGE 3: HOOKS ---
    const { object: hooksObj } = await generateObject({
      model: provider(targetModel),
      schema: HooksSchema,
      prompt: Prompts.GENERATE_HOOKS.replace('{{insight}}', frameObj.insight),
    });
    const selectedHook = hooksObj.hooks[0];
    console.log(`[Content Brain] ✅ Stage 3 Done.`);

    // --- STAGE 3.5: RESONANCE ---
    console.log(`[Content Brain] Stage 3.5: Checking Resonance Engine...`);
    const templates = await db.postTemplate.findMany();
    let draftPrompt = Prompts.GENERATE_DRAFT
      .replace('{{hook}}', selectedHook)
      .replace('{{insight}}', frameObj.insight);

    if (templates.length > 0) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      console.log(`[Content Brain] 🔬 Resonance Template Found: "${template.name}". Injecting...`);
      draftPrompt += `\n\nCRITICAL FORMATTING OVERRIDE (ATLAS RESONANCE ENGINE):\n${template.formatStructure}\n\n Pace: ${template.pacing}`;
    } else {
      console.log(`[Content Brain] No resonance templates in DB. Using standard generation.`);
    }

    // --- STAGE 4: DRAFT ---
    const { object: initialDraft } = await generateObject({
      model: provider(targetModel),
      schema: DraftSchema,
      prompt: draftPrompt,
    });
    console.log(`[Content Brain] ✅ Stage 4 Done.`);

    // --- STAGE 5: EVAL ---
    const { object: evalObj } = await generateObject({
      model: provider(targetModel),
      schema: EvalSchema,
      prompt: Prompts.EVALUATE_DRAFT.replace('{{draft}}', initialDraft.x_post),
    });
    console.log(`[Content Brain] ✅ Stage 5 Done. Score: ${evalObj.score}/10`);

    let finalDraft = initialDraft;

    // --- STAGE 6: REWRITE ---
    if (evalObj.score < 8 && evalObj.flaws.length > 0) {
      const { object: rewrittenDraft } = await generateObject({
        model: provider(targetModel),
        schema: DraftSchema,
        prompt: Prompts.REWRITE_DRAFT
          .replace('{{draft}}', `X: ${initialDraft.x_post}\n\nLinkedIn: ${initialDraft.linkedin_post}`)
          .replace('{{flaws}}', evalObj.flaws.join('\n')),
      });
      finalDraft = rewrittenDraft;
      console.log(`[Content Brain] ✅ Stage 6 Done (Rewrite applied).`);
    }

    // --- STAGE 6.5: VISUALS ---
    let finalMediaUrl: string | undefined = undefined;
    if (process.env.FAL_KEY) {
      console.log(`[Content Brain] Stage 6.5: Generating visual media (Mode: ${item.mode})...`);
      const mediaStart = Date.now();
      try {
        if (item.mode === 'FOUNDER') {
          const imagePrompt = `A minimalist, high-contrast tech brain dump... ${frameObj.insight}`;
          finalMediaUrl = await generateImageWithFlux(imagePrompt);
        } else {
          const { object: imageTextObj } = await generateObject({
             model: provider(targetModel),
             schema: ImageHeadlineSchema,
             prompt: `Distill news insight into 4-7 words: ${frameObj.insight}`,
          });
          finalMediaUrl = await generateImageWithFlux(`Minimalist tech news plate: "${imageTextObj.headline}"`);
        }
        console.log(`[Content Brain] ✅ Visuals generated (${Date.now() - mediaStart}ms): ${finalMediaUrl}`);
      } catch (mediaErr) {
        console.warn(`[Content Brain] ⚠️ Visual generation failed:`, mediaErr);
      }
    } else {
      console.log(`[Content Brain] Skipping Stage 6.5 (FAL_KEY missing).`);
    }

    // --- STAGE 7: PERSIST ---
    console.log(`[Content Brain] Stage 7: Persisting drafts to DB...`);
    const persistStart = Date.now();
    const draftX = await db.draft.create({
      data: {
        contentItemId: item.id,
        platform: 'x',
        body: finalDraft.x_post,
        status: 'pending',
        qualityScore: evalObj.score,
        mediaUrl: finalMediaUrl
      }
    });

    const draftLn = await db.draft.create({
      data: {
        contentItemId: item.id,
        platform: 'linkedin',
        body: finalDraft.linkedin_post,
        status: 'pending',
        qualityScore: evalObj.score,
        mediaUrl: finalMediaUrl
      }
    });
    console.log(`[Content Brain] ✅ DB Persistence Done (${Date.now() - persistStart}ms). Draft IDs: X=${draftX.id}, LN=${draftLn.id}`);

    // --- STAGE 8: DISPATCH ---
    console.log(`[Content Brain] Stage 8: Emitting completion event...`);
    await emitEvent(EventTypes.CONTENT_DRAFTED, {
      contentItemId: item.id,
      draftIds: [draftX.id, draftLn.id],
      platforms: ['x', 'linkedin']
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`\n${timestamp}`);
    console.log(`[Content Brain] 🎉 PIPELINE COMPLETE for ${item.id}`);
    console.log(`[Content Brain] Total Processing Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`${timestamp}\n`);

  } catch (err: any) {
    console.error(`\n${new Array(40).fill('!').join('')}`);
    console.error(`[Content Brain] 🔥 FATAL PIPELINE ERROR for Item: ${payload.contentItemId}`);
    console.error(`[Content Brain] Error Name: ${err.name}`);
    console.error(`[Content Brain] Error Message: ${err.message}`);
    if (err.stack) console.error(`[Content Brain] Stack Trace:\n${err.stack}`);
    console.error(`${new Array(40).fill('!').join('')}\n`);
  }
}

/**
 * Worker Boot sequence wrapper.
 */
function startWorker() {
  console.log("\n[Content Brain] 🚀 Worker Initializing...");
  console.log(`[Content Brain] 📅 Timestamp: ${new Date().toISOString()}`);

  const worker = createEventWorker(EventTypes.CONTENT_DRAFT_REQUESTED, async (event: AtlasEvent) => {
    console.log(`[Content Brain] 📥 RECEIVED EVENT: ${event.eventType}`);
    if (event.eventType === EventTypes.CONTENT_DRAFT_REQUESTED) {
      await processDraftPipeline(event.payload as ContentDraftRequestedPayload);
    } else {
      console.warn(`[Content Brain] ⚠️ Ignored unknown event type: ${event.eventType}`);
    }
  });

  console.log(`[Content Brain] 👂 Listening for ${EventTypes.CONTENT_DRAFT_REQUESTED} queue...`);

  const shutdown = async () => {
    console.log("\n[Content Brain] 🛑 Shutting down...");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorker();
