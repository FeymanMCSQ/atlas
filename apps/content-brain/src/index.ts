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

/**
 * AI Generation Pipeline orchestrator logic.
 */
async function processDraftPipeline(payload: ContentDraftRequestedPayload) {
  const item = await db.contentItem.findUnique({ where: { id: payload.contentItemId } });
  if (!item) {
    console.error(`[Content Brain] ContentItem ${payload.contentItemId} not found.`);
    return;
  }

  let rawContent = '';

  if (item.source === 'transcript') {
    const data = item.sourceData as any;
    if (data && data.transcriptId) {
      const transcript = await db.transcript.findUnique({ where: { id: data.transcriptId } });
      rawContent = transcript?.transcriptText || '';
    }
  } else {
    // Basic fallback for other sources like RSS or ingestions
    rawContent = item.summary || JSON.stringify(item.sourceData);
  }

  if (!rawContent || rawContent.trim() === '') {
    console.log(`[Content Brain] Extracted text for ${item.id} is empty. Aborting AI generation.`);
    return;
  }

  const Prompts = item.mode === 'FOUNDER' ? FounderPrompts : InformationPrompts;
  const targetModel = payload.model || DEFAULT_MODEL;
  console.log(`\n[Content Brain] Initiating 6-stage AI generation for ${item.id} (MODE: ${item.mode}) (MODEL: ${targetModel})...`);

  try {
    // 1. Extract Signals
    const { object: signalsObj } = await generateObject({
      model: provider(targetModel),
      schema: ExtractSchema,
      prompt: Prompts.EXTRACT_SIGNALS.replace('{{content}}', rawContent),
    });
    console.log(` > Stage 1: Extracted ${signalsObj.signals.length} signals.`);

    // 2. Frame Insight
    const { object: frameObj } = await generateObject({
      model: provider(targetModel),
      schema: FrameSchema,
      prompt: Prompts.FRAME_INSIGHT.replace('{{signals}}', signalsObj.signals.join('\n')),
    });
    console.log(` > Stage 2: Insight established -> "${frameObj.insight.substring(0, 50)}..."`);

    // 3. Generate Hooks
    const { object: hooksObj } = await generateObject({
      model: provider(targetModel),
      schema: HooksSchema,
      prompt: Prompts.GENERATE_HOOKS.replace('{{insight}}', frameObj.insight),
    });
    const selectedHook = hooksObj.hooks[0];
    console.log(` > Stage 3: Generated hooks. Selected -> "${selectedHook}"`);

    // 4. Initial Draft Generation
    const { object: initialDraft } = await generateObject({
      model: provider(targetModel),
      schema: DraftSchema,
      prompt: Prompts.GENERATE_DRAFT
        .replace('{{hook}}', selectedHook)
        .replace('{{insight}}', frameObj.insight),
    });
    console.log(` > Stage 4: Draft frameworks successfully synthesized.`);

    // 5. Quality Critique (Evaluates the more rigid X post specifically for pacing)
    const { object: evalObj } = await generateObject({
      model: provider(targetModel),
      schema: EvalSchema,
      prompt: Prompts.EVALUATE_DRAFT.replace('{{draft}}', initialDraft.x_post),
    });
    console.log(` > Stage 5: Quality evaluation complete. Score: ${evalObj.score}/10`);

    let finalDraft = initialDraft;

    // 6. Rewrite If Necessary
    if (evalObj.score < 8 && evalObj.flaws.length > 0) {
      console.log(` > Stage 6: Score < 8. Triggering AI rewrite pipeline to address flaws...`);
      const { object: rewrittenDraft } = await generateObject({
        model: provider(targetModel),
        schema: DraftSchema,
        prompt: Prompts.REWRITE_DRAFT
          .replace('{{draft}}', `X: ${initialDraft.x_post}\n\nLinkedIn: ${initialDraft.linkedin_post}`)
          .replace('{{flaws}}', evalObj.flaws.join('\n')),
      });
      finalDraft = rewrittenDraft;
      console.log(` > Stage 6: Rewrite complete.`);
    } else {
      console.log(` > Stage 6: Skipping rewrite (Quality is sufficient).`);
    }

    // 6.5. Visual Image Attachment Strategy 2
    let finalMediaUrl: string | undefined = undefined;
    console.log(` > Stage 6.5: Acquring visual media for ${item.mode} mode...`);
    try {
      if (item.mode === 'FOUNDER') {
        const imagePrompt = `A minimalist, high-contrast digital notebook sketchbook or blueprint design representing the concept of: ${frameObj.insight}. 
        Aesthetic: "Build-in-public" scrappy tech entrepreneur. Hand-drawn wireframes, technical flowcharts, and minimalist geometric structural lines on a dark-mode background. 
        It should look like an intelligent founder's brain dump on a digital whiteboard.
        CRITICAL RULE: DO NOT include any text, letters, typography, or numbers. Keep it completely text-free and abstract.`;
        finalMediaUrl = await generateImageWithFlux(imagePrompt);
        console.log(`   🎨 AI Image Generated via Fal.ai -> ${finalMediaUrl}`);
      } else {
        // Information Mode
        if (item.imageUrl) {
          finalMediaUrl = item.imageUrl;
          console.log(`   📸 Reusing ingested Publisher image -> ${finalMediaUrl}`);
        } else {
          console.log(`   🔍 No publisher image found. Searching Google for relevant logo...`);
          const searchQuery = `${item.source} ${frameObj.insight.substring(0, 30)} logo high quality`;
          const searched = await searchGoogleImages(searchQuery);
          if (searched) {
             finalMediaUrl = searched;
             console.log(`   🌐 Found Search Image -> ${finalMediaUrl}`);
          }
        }
      }
    } catch (mediaErr) {
       console.error(`   ⚠️ Failed to acquire visual media:`, mediaErr);
    }

    // 7. Persist to Postgres
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

    console.log(`[Content Brain] Draft records saved: X (${draftX.id}), LinkedIn (${draftLn.id})`);

    // 8. Event Dispatch
    await emitEvent(EventTypes.CONTENT_DRAFTED, {
      contentItemId: item.id,
      draftIds: [draftX.id, draftLn.id],
      platforms: ['x', 'linkedin']
    });
    console.log(`[Content Brain] ✅ Emitted content.drafted successfully.\n`);

  } catch (err) {
    console.error(`[Content Brain] Fatal generation error:`, err);
  }
}

/**
 * Worker Boot sequence wrapper.
 */
function startWorker() {
  console.log("Atlas content-brain worker online");
  console.log(`Listening strictly for ${EventTypes.CONTENT_DRAFT_REQUESTED}...\\n`);

  const worker = createEventWorker(EventTypes.CONTENT_DRAFT_REQUESTED, async (event: AtlasEvent) => {
    if (event.eventType === EventTypes.CONTENT_DRAFT_REQUESTED) {
      await processDraftPipeline(event.payload as ContentDraftRequestedPayload);
    }
  });

  const shutdown = async () => {
    console.log("\\nShutting down content-brain...");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorker();
