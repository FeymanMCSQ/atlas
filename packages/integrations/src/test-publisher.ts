import { sendTweet } from './x-client';
import { postToLinkedIn } from './linkedin-client';

async function testPublishers() {
  const timestamp = new Date().toISOString();
  const message = `Hello from Atlas! 🚀 The pipeline is coming alive. (Test at ${timestamp})`;

  console.log('--- Atlas Publisher Test ---');

  // 1. Test X
  console.log('\n🐦 Testing X (Twitter)...');
  try {
    const tweet = await sendTweet(message);
    console.log(`✅ X Success! Tweet ID: ${tweet.id}`);
  } catch (error: any) {
    console.error(`❌ X Failed: ${error.message}`);
  }

  // 2. Test LinkedIn
  console.log('\n🔗 Testing LinkedIn...');
  try {
    const li = await postToLinkedIn(message);
    console.log(`✅ LinkedIn Success! Post ID/URN: ${li.id}`);
  } catch (error: any) {
    console.error(`❌ LinkedIn Failed: ${error.message}`);
  }

  console.log('\n--- Test Complete ---');
}

testPublishers();
