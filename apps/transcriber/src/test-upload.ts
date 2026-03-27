import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('\n=== Transcriber Upload Test ===\n');

  // 1. Fetch a real dummy audio file (Deepgram rejects invalid binary headers)
  const dummyFilePath = path.resolve(__dirname, '../speech.ogg');

  try {
    // 2. Build form data manually since we are in node (can use Blob)
    const fileContent = fs.readFileSync(dummyFilePath);
    
    // We can use standard node fetch with FormData if Node >= 18
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'audio/ogg' });
    formData.append('audio', blob, 'speech.ogg');

    // 3. Send to local server
    console.log('📤 Uploading dummy audio to Transcriber...');
    const response = await fetch('http://localhost:4000/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    console.log('\n--- Server Response ---');
    console.log(`Status: ${response.status}`);
    console.log(data);

    if (response.ok && data.transcriptId && data.contentItemId) {
      console.log('\\n✅ PASS: Audio file transcribed successfully. Transcript ID: ' + data.transcriptId);
    } else {
      console.log('\\n❌ FAIL: Upload rejected or invalid response.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ FAIL: Request error:', error);
    process.exit(1);
  } finally {
    // Clean up completely omitted since speech.ogg is static and reliable
    console.log('\nTest complete.');
  }
}

runTest();
