import { NextResponse } from 'next/server';
import { emitEvent } from '@atlas/queue';
import { EventTypes, ContentDraftRequestedPayload } from '@atlas/domain';
import { db } from '@atlas/db';

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[API] [${requestId}] POST /api/synthesize - START`);

  try {
    const body = await request.json();
    const { contentItemId, mode, model } = body;
    console.log(`[API] [${requestId}] Payload: id=${contentItemId}, mode=${mode}, model=${model}`);
    
    if (!contentItemId) {
      console.error(`[API] [${requestId}] ERROR: Missing contentItemId`);
      return NextResponse.json({ error: 'Missing contentItemId' }, { status: 400 });
    }

    if (mode) {
      console.log(`[API] [${requestId}] Updating mode for ${contentItemId} to ${mode}...`);
      await db.contentItem.update({
        where: { id: contentItemId },
        data: { mode }
      });
      console.log(`[API] [${requestId}] DB update successful.`);
    }

    console.log(`[API] [${requestId}] Clearing stale drafts...`);
    await db.draft.deleteMany({
      where: { contentItemId }
    });
    console.log(`[API] [${requestId}] Drafts cleared.`);

    const payload: ContentDraftRequestedPayload = {
      contentItemId,
      model,
    };
    
    console.log(`[API] [${requestId}] Emitting CONTENT_DRAFT_REQUESTED event to Redis...`);
    // Explicitly offload draft generation strictly to the queue to protect DDD.
    await emitEvent(EventTypes.CONTENT_DRAFT_REQUESTED, payload);
    console.log(`[API] [${requestId}] ✅ Event successfully emitted.`);

    return NextResponse.json({ success: true, message: 'Draft synthesis requested successfully' });
  } catch (error: any) {
    console.error(`[API] [${requestId}] 🔥 FATAL ERROR:`, error.message);
    if (error.stack) console.error(error.stack);
    return NextResponse.json({ error: `Internal execution failure: ${error.message}` }, { status: 500 });
  }
}
