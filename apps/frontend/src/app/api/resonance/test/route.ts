import { NextResponse } from 'next/server';
import { db } from '@atlas/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    console.log('[Resonance Circuit Test] Step 1: Connecting to DB and fetching templates...');
    const startTime = Date.now();
    const templates = await db.postTemplate.findMany();
    console.log(`[Resonance Circuit Test] Step 1 Complete: Found ${templates.length} templates (took ${Date.now() - startTime}ms).`);

    let result = {
      message: 'Resonance Engine circuit execution complete',
      steps: [] as any[],
    };

    result.steps.push({
      step: 1,
      description: 'Fetch Templates',
      count: templates.length,
      templates: templates.map((t: any) => ({ id: t.id, name: t.name }))
    });

    console.log('[Resonance Circuit Test] Step 2: Selecting random template and mapping base prompt...');
    if (templates.length === 0) {
      console.log('[Resonance Circuit Test] Step 2 Result: No templates available. Aborting format injection.');
      result.steps.push({
        step: 2,
        description: 'Template Selection',
        status: 'SKIPPED_EMPTY_DB'
      });
      return NextResponse.json(result);
    }

    const template = templates[Math.floor(Math.random() * templates.length)];
    console.log(`[Resonance Circuit Test] Step 2 Complete: Selected template "${template.name}".`);
    
    result.steps.push({
      step: 2,
      description: 'Template Selection',
      selectedId: template.id,
      selectedName: template.name
    });

    console.log('[Resonance Circuit Test] Step 3: Injecting Critical Formatting Override...');
    const formatOverrideString = `\n\nCRITICAL FORMATTING OVERRIDE (ATLAS RESONANCE ENGINE):\n${template.formatStructure}\n\n Pace: ${template.pacing}`;
    console.log(`[Resonance Circuit Test] Step 3 Complete: Injection string appended.\n=== INJECTION SAMPLE ===\n${formatOverrideString}\n========================`);
    
    result.steps.push({
      step: 3,
      description: 'Format Injection Construction',
      injectedString: formatOverrideString
    });

    return NextResponse.json(result);

  } catch (err: any) {
    console.error('[Resonance Circuit Test] 🔥 FATAL ERROR in circuit:', err);
    return NextResponse.json({ error: 'Circuit failure', details: err.message }, { status: 500 });
  }
}
