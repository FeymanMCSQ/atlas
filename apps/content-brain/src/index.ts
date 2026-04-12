import { createEventWorker, emitEvent } from "@atlas/queue";
import { EventTypes, AtlasEvent, ContentDraftRequestedPayload } from "@atlas/domain";
import { db } from "@atlas/db";
import { FounderPrompts, InformationPrompts } from "@atlas/prompts";
// @ts-ignore
import { searchGoogleImages } from "@atlas/integrations/src/serper-client.js";
// @ts-ignore
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

  headline: z.string().describe("A hyper-condensed 4 to 7 word news headline representing the core insight.")
});

/**
 * Smart Structural Matcher
 * Analyzes the news item and available templates to find the most resonant structural fit.
 */
async function selectBestTemplate(insight: string, templates: any[], manualTemplateId?: string, model?: string) {
  if (manualTemplateId) {
    const manual = templates.find(t => t.id === manualTemplateId);
    if (manual) return manual;
  }

  if (templates.length === 0) return null;
  if (templates.length === 1) return templates[0];

  console.log(`[Resonance Circuit] 🧠 Intelligently matching structure to insight...`);
  try {
    const { object: selection } = await generateObject({
      model: provider(model || DEFAULT_MODEL),
      schema: z.object({
        bestTemplateId: z.string().describe("The ID of the template that best fits the emotional/structural vibe of the news.")
      }),
      prompt: `
        You are a Structural Resonance Expert.
        
        Insight to map: "${insight}"
        
        Available Viral Structures:
        ${templates.map(t => `- [${t.id}] ${t.name}: ${t.hookArchetype}`).join('\n')}
        
        Which of these templates provides the most appropriate "vibe" for this insight? 
        Select the ID of the best fit.
      `
    });
    return templates.find(t => t.id === selection.bestTemplateId) || templates[0];
  } catch (err) {
    console.warn(`[Resonance Circuit] Smart mapping failed, falling back to top selection.`);
    return templates[0];
  }
}


async function processDraftPipeline(payload: ContentDraftRequestedPayload) {
  try {
    const item = await db.contentItem.findUnique({ where: { id: payload.contentItemId } });

    
    if (!item) {
      console.error(`[Content Brain] ❌ ContentItem ${payload.contentItemId} not found in database.`);
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
      rawContent = item.summary || JSON.stringify(item.sourceData);

      if (item.url && item.url.startsWith('http')) {
        const scrapeStart = Date.now();

        try {
          const jinaRes = await fetch(`https://r.jina.ai/${item.url}`, {
            signal: AbortSignal.timeout(15000)
          });
          if (jinaRes.ok) {
             const deepMarkdown = await jinaRes.text();
             if (deepMarkdown && deepMarkdown.length > 50) {
               rawContent = deepMarkdown.substring(0, 8000); 
             }
          }
        } catch (e: any) {
           // Scrape failed, moving on with summary
        }

      }
    }

    if (!rawContent || rawContent.trim() === '') {
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

    // --- STAGE 2: FRAME ---
    const { object: frameObj } = await generateObject({
      model: provider(targetModel),
      schema: FrameSchema,
      prompt: Prompts.FRAME_INSIGHT.replace('{{signals}}', signalsObj.signals.join('\n')),
    });


    // --- STAGE 3: HOOKS ---
    const { object: hooksObj } = await generateObject({
      model: provider(targetModel),
      schema: HooksSchema,
      prompt: Prompts.GENERATE_HOOKS.replace('{{insight}}', frameObj.insight),
    });
    const selectedHook = hooksObj.hooks[0];

    // --- STAGE 3.5: RESONANCE ENGINE ---
    // [STEP 1] Fetch existing psychological templates
    console.log(`[Resonance Circuit] Step 1: Connecting to DB to fetch post templates...`);
    const templates = await db.postTemplate.findMany();
    console.log(`[Resonance Circuit] Step 1 Complete -> Found ${templates.length} templates.`);

    let draftPrompt = Prompts.GENERATE_DRAFT
      .replace('{{hook}}', selectedHook)
      .replace('{{insight}}', frameObj.insight);

    // [STEP 2] Check availability and select 
    console.log(`[Resonance Circuit] Step 2: Evaluating template mapping...`);
    const template = await selectBestTemplate(
        frameObj.insight, 
        templates, 
        payload.templateId, 
        targetModel
    );

    if (template) {
      console.log(`[Resonance Circuit] Step 2 Complete -> Selected Structure: "${template.name}"`);
      
      // [STEP 3] Inject critical formatting override
      console.log(`[Resonance Circuit] Step 3: Injecting formatting override into system prompt...`);
      draftPrompt += `\n\nCRITICAL FORMATTING OVERRIDE (ATLAS RESONANCE ENGINE):\n${template.formatStructure}\n\n Pace: ${template.pacing}`;
      console.log(`[Resonance Circuit] Step 3 Complete -> Injection string appended successfully.`);
    } else {
      console.log(`[Resonance Circuit] Step 2/3 Result -> No templates available. Bypassing engine.`);
    }



    // --- STAGE 4: DRAFT ---
    const { object: initialDraft } = await generateObject({
      model: provider(targetModel),
      schema: DraftSchema,
      prompt: draftPrompt,
    });

    // --- STAGE 5: EVAL ---
    const { object: evalObj } = await generateObject({
      model: provider(targetModel),
      schema: EvalSchema,
      prompt: Prompts.EVALUATE_DRAFT.replace('{{draft}}', initialDraft.x_post),
    });

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
    }

    // --- STAGE 6.5: VISUALS ---
    let finalMediaUrl: string | undefined = undefined;
    if (process.env.FAL_KEY) {
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
      } catch (mediaErr) {
        // Silently ignore media errors
      }
    }


    // --- STAGE 7: PERSIST ---
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


    // --- STAGE 8: DISPATCH ---
    await emitEvent(EventTypes.CONTENT_DRAFTED, {
      contentItemId: item.id,
      draftIds: [draftX.id, draftLn.id],
      platforms: ['x', 'linkedin']
    });

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
  const worker = createEventWorker(EventTypes.CONTENT_DRAFT_REQUESTED, async (event: AtlasEvent) => {
    if (event.eventType === EventTypes.CONTENT_DRAFT_REQUESTED) {
      await processDraftPipeline(event.payload as ContentDraftRequestedPayload);
    }
  });


  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };


  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorker();
