import { cleanTranscriptText } from './normalizer';

function runTests() {
  console.log('=== Normalizer Unit Tests ===\\n');

  const testCases = [
    {
      input: 'Well, [00:15] um, I think that, uh, you know, the codebase is good.',
      expected: 'Well, I think that, the codebase is good.'
    },
    {
      input: 'So (01:23:45) ah, this is a test um of the system.',
      expected: 'So, this is a test of the system.'
    },
    {
      input: '12:34 Hmm, we should deploy now.',
      expected: 'we should deploy now.'
    },
    {
      input: 'No timestamps here, just um some text.',
      expected: 'No timestamps here, just some text.'
    }
  ];

  let passed = 0;
  for (let i = 0; i < testCases.length; i++) {
    const { input, expected } = testCases[i];
    const output = cleanTranscriptText(input);

    if (output === expected) {
      console.log(`✅ Test ${i + 1} passed.`);
      passed++;
    } else {
      console.log(`❌ Test ${i + 1} failed.`);
      console.log(`   Input:    "${input}"`);
      console.log(`   Expected: "${expected}"`);
      console.log(`   Output:   "${output}"`);
    }
  }

  console.log(`\\n${passed}/${testCases.length} tests passed.`);
  if (passed !== testCases.length) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
