import { NextResponse } from 'next/server';
import { emitEvent } from '@atlas/queue';
import { EventTypes, ContentPublishRequestedPayload } from '@atlas/domain';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { draftId, platform } = body;
    
    if (!draftId || !platform) {
      return NextResponse.json({ error: 'Missing required fields: draftId, platform' }, { status: 400 });
    }

    const payload: ContentPublishRequestedPayload = {
      draftId,
      platform,
    };
    
    // Fire the publish request into the background pipeline Orchestrator
    await emitEvent(EventTypes.CONTENT_PUBLISH_REQUESTED, payload);

    return NextResponse.json({ success: true, message: `Publish requested for ${platform}` });
  } catch (error) {
    console.error('[API] POST /publish error:', error);
    return NextResponse.json({ error: 'Failed to enact publishing protocol' }, { status: 500 });
  }
}
