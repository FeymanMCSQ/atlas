import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('\n=== Transcriber Upload Test ===\n');

  // 1. Fetch a real dummy audio file (Deepgram rejects invalid binary headers)
  const dummyFilePath = path.resolve(__dirname, 'dummy-audio.mp3');
  console.log('📥 Downloading real dummy audio file...');
  const fileRes = await fetch('https://www.w3schools.com/html/horse.mp3');
  const arrayBuffer = await fileRes.arrayBuffer();
  fs.writeFileSync(dummyFilePath, Buffer.from(arrayBuffer));

  try {
    // 2. Build form data manually since we are in node (can use Blob)
    const fileContent = fs.readFileSync(dummyFilePath);
    
    // We can use standard node fetch with FormData if Node >= 18
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'audio/mpeg' });
    formData.append('audio', blob, 'dummy-audio.mp3');

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
    // Clean up
    if (fs.existsSync(dummyFilePath)) {
      fs.unlinkSync(dummyFilePath);
    }
    console.log('\nTest complete.');
  }
}

runTest();
