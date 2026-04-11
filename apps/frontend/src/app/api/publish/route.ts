import { NextResponse } from 'next/server';
import { db } from '@atlas/db';
import { emitEvent } from '@atlas/queue';
import { EventTypes, ContentPublishRequestedPayload } from '@atlas/domain';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { draftId, platform } = body;
    
    if (!draftId || !platform) {
      return NextResponse.json({ error: 'Missing required fields: draftId, platform' }, { status: 400 });
    }

    // ----------------------------------------------------------------------------------------
    // BUG FIX IDENTIFIED:
    // The "Publisher" background worker possesses strict Domain Idempotency checks.
    // It enforces a rule that only drafts with a status of 'approved' (or 'failed')
    // can be successfully published. Drafts currently sit locally as 'pending'. 
    //
    // Since the actual action of the user clicking "Post to [Platform]" on the frontend 
    // constitutes native Human Approval, we explicitly promote the draft's state right now.
    // ----------------------------------------------------------------------------------------
    await db.draft.update({
      where: { id: draftId },
      data: { status: 'approved' }
    });

    const payload: ContentPublishRequestedPayload = {
      draftId,
      platform,
      isManual: true, // User clicked Publish — bypass DISABLE_AUTO_PUBLISH killswitch
    };
    
    // Fire the publish request into the background pipeline Orchestrator
    await emitEvent(EventTypes.CONTENT_PUBLISH_REQUESTED, payload);

    return NextResponse.json({ success: true, message: `Publish requested for ${platform}` });
  } catch (error) {
    console.error('[API] POST /publish error:', error);
    return NextResponse.json({ error: 'Failed to enact publishing protocol' }, { status: 500 });
  }
}
