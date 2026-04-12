import { NextResponse } from 'next/server';
import { emitEvent } from '@atlas/queue';
import { EventTypes } from '@atlas/domain';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    console.log('[API] Processing manual RESONANCE_HUNT_REQUESTED...');
    
    // Emit the event to Redis. The feed-ingestor worker will pick it up.
    await emitEvent(EventTypes.RESONANCE_HUNT_REQUESTED, {});

    return NextResponse.json({ 
      success: true, 
      message: 'X-Factor Resonance Hunt successfully triggered in the background.' 
    });

  } catch (err: any) {
    console.error('[API] Failed to trigger Resonance Hunt:', err.message);
    return NextResponse.json({ 
      error: 'Failed to trigger hunt', 
      details: err.message 
    }, { status: 500 });
  }
}
