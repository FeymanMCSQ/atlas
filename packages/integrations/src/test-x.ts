import { sendTweet } from './x-client';

async function testConnection() {
  console.log('🚀 Testing X API Connection...');
  
  try {
    const tweet = await sendTweet('Hello from Atlas! 🚀 The pipeline is coming alive.');
    console.log('✅ Tweet successfully posted!');
    console.log('Tweet ID:', tweet.id);
    console.log('Text:', tweet.text);
  } catch (error) {
    console.error('❌ Test Failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testConnection();
}
