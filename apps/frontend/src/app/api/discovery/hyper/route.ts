import { NextResponse } from 'next/server';
import { emitEvent } from '@atlas/queue';
import { EventTypes } from '@atlas/domain';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    console.log('[API] Processing manual HYPER_DISCOVERY_REQUESTED...');
    
    // Emit the event to Redis. The feed-ingestor worker will pick it up.
    await emitEvent(EventTypes.HYPER_DISCOVERY_REQUESTED, {});

    return NextResponse.json({ 
      success: true, 
      message: 'Atomic Pulse Hyper-Discovery successfully triggered in the background.' 
    });

  } catch (err: any) {
    console.error('[API] Failed to trigger Hyper-Discovery:', err.message);
    return NextResponse.json({ 
      error: 'Failed to trigger pulse check', 
      details: err.message 
    }, { status: 500 });
  }
}
