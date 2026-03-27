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
