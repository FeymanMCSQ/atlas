import { NextResponse } from 'next/server';
import { db } from '@atlas/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const feeds = await db.feedSource.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ feeds });
  } catch (error) {
    console.error('[API] GET /feeds error:', error);
    return NextResponse.json({ error: 'Failed to fetch feeds' }, { status: 500 });
  }
}
