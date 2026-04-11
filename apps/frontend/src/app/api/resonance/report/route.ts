import { NextResponse } from 'next/server';
import { db } from '@atlas/db';

export async function GET() {
  try {
    // Get the 7 most recent daily reports
    const reports = await db.resonanceReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 7
    });

    return NextResponse.json({ success: true, reports });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
