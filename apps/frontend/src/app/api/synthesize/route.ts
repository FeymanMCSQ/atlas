import { NextResponse } from 'next/server';
import { emitEvent } from '@atlas/queue';
import { EventTypes, ContentDraftRequestedPayload } from '@atlas/domain';
import { db } from '@atlas/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contentItemId, mode, model } = body;
    
    if (!contentItemId) {
      return NextResponse.json({ error: 'Missing contentItemId' }, { status: 400 });
    }

    if (mode) {
      await db.contentItem.update({
        where: { id: contentItemId },
        data: { mode }
      });
    }

    // Crucial: Delete any old drafts so the UI polling doesn't immediately exit with stale data
    await db.draft.deleteMany({
      where: { contentItemId }
    });

    const payload: ContentDraftRequestedPayload = {
      contentItemId,
      model,
    };
    
    // Explicitly offload draft generation strictly to the queue to protect DDD.
    await emitEvent(EventTypes.CONTENT_DRAFT_REQUESTED, payload);

    return NextResponse.json({ success: true, message: 'Draft synthesis requested successfully' });
  } catch (error) {
    console.error('[API] POST /synthesize error:', error);
    return NextResponse.json({ error: 'Failed to request synthesis' }, { status: 500 });
  }
}
