import { NextResponse } from 'next/server';
import { db } from '@atlas/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contentItemId = url.searchParams.get('contentItemId');
    
    if (!contentItemId) {
      return NextResponse.json({ error: 'Missing contentItemId' }, { status: 400 });
    }
    
    const drafts = await db.draft.findMany({
      where: { contentItemId },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('[API] GET /drafts error:', error);
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { draftId, body } = await request.json();
    if (!draftId || !body) {
      return NextResponse.json({ error: 'Missing draftId or body' }, { status: 400 });
    }
    
    await db.draft.update({
      where: { id: draftId },
      data: { body }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] PATCH /drafts error:', error);
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
}
