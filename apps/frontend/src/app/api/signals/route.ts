import { NextResponse } from 'next/server';
import { db } from '@atlas/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const feedId = url.searchParams.get('feedId');
    
    // Default to a 20-item limit to prevent swamping the client
    let whereClause = {};
    if (feedId === 'TREND') {
      whereClause = { source: { startsWith: '[Trend]' } };
    } else if (feedId === 'PULSE') {
      whereClause = { source: { startsWith: '[Pulse]' } };
    } else if (feedId) {
      whereClause = { source: feedId };
    }
    
    const signals = await db.contentItem.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    
    return NextResponse.json({ signals });
  } catch (error) {
    console.error('[API] GET /signals error:', error);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
