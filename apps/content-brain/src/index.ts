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

    // Deep Web Information Mode Scraper (Jina Reader)
    if ((item.mode === 'INFORMATION' || item.source.startsWith('[Trend]')) && item.url) {
      console.log(`\n[Content Brain] 🕸️ Invoking Deep Scraper via Jina Reader: ${item.url}`);
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${item.url}`, {
          signal: AbortSignal.timeout(15000)
        });
        if (jinaRes.ok) {
           const deepMarkdown = await jinaRes.text();
           if (deepMarkdown && deepMarkdown.length > 50) {
             // Hard cap at 8,000 characters to prevent token ingestion explosion
             rawContent = deepMarkdown.substring(0, 8000); 
             console.log(`[Content Brain] ✅ Deep Scrape successful: ${rawContent.length} chars stored for contextual analysis.`);
           } else {
             console.log(`[Content Brain] ⚠️ Deep Scrape returned blank markdown, falling back to summary.`);
           }
        } else {
           console.log(`[Content Brain] ⚠️ Deep Scrape blocked (HTTP ${jinaRes.status}), falling back to summary.`);
        }
      } catch (e: any) {
         console.warn(`[Content Brain] ⚠️ Deep Scrape timeout/failure: ${e.message}. Using fallback.`);
      }
    }
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
      prompt: Prompts.EXTRACT_SIGNALS
          .replace('{{title}}', item.title)
          .replace('{{content}}', rawContent),
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

    // 3.5 Check Resonance Engine for Viral Templates
    const templates = await db.postTemplate.findMany();
    let draftPrompt = Prompts.GENERATE_DRAFT
      .replace('{{hook}}', selectedHook)
      .replace('{{insight}}', frameObj.insight);

    if (templates.length > 0) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      console.log(` > Resonance Engine active. Injecting viral template -> "${template.name}"`);
      draftPrompt += `\n\nCRITICAL FORMATTING OVERRIDE (ATLAS RESONANCE ENGINE):
      Ignore any generic formatting advice. You MUST structure this post EXACTLY following this proven viral framework:
      - Hook Psychology: ${template.hookArchetype}
      - Pace & Tone: ${template.pacing}
      - Structural Rhythm: ${template.formatStructure}
      
      Use this reconstructed example to understand the cadence and replicate it perfectly, but replace the content with our actual insight:
      ${template.examples}`;
    }

    // 4. Initial Draft Generation
    const { object: initialDraft } = await generateObject({
      model: provider(targetModel),
      schema: DraftSchema,
      prompt: draftPrompt,
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

    // 6.5. Visual Image Attachment Strategy
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
        // Information Mode - Typography Plate
        console.log(`   🔤 Distilling news into Typography Plate...`);
        const { object: imageTextObj } = await generateObject({
          model: provider(targetModel),
          schema: ImageHeadlineSchema,
          prompt: `Distill this news insight into a punchy, click-heavy 4 to 7 word headline to be printed on an image: ${frameObj.insight}`,
        });
        
        const cleanHeadline = imageTextObj.headline.toUpperCase();
        console.log(`   🔤 Distilled Headline: "${cleanHeadline}"`);

        const imagePrompt = `A pristine, ultra-minimalist social media news plate graphic. Aesthetic: High-end B2B SaaS, deep obsidian dark-mode background with a subtle ambient glowing blue gradient. 
        In the absolute center, crisp, large, elegant white sans-serif typography that reads exactly: "${cleanHeadline}". 
        CRITICAL RULE: The text "${cleanHeadline}" must be central and spelled perfectly. No other text. Massive negative space. No abstract robots or messy elements. Sharp, corporate, futuristic perfection.`;
        
        finalMediaUrl = await generateImageWithFlux(imagePrompt);
        console.log(`   🎨 AI Typography Plate Generated via Fal.ai -> ${finalMediaUrl}`);
      }
    } catch (mediaErr) {
       console.error(`   ⚠️ Failed to acquire visual media:`, mediaErr);
       // Fallback completely if Flux crashes
       if (item.mode === 'INFORMATION' && item.imageUrl) {
         finalMediaUrl = item.imageUrl;
         console.log(`   📸 Reverting to ingested Publisher image fallback -> ${finalMediaUrl}`);
       }
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
