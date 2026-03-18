import { TwitterApi } from 'twitter-api-v2';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const client = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY || '',
  appSecret: process.env.X_SECRET_KEY || '',
  accessToken: process.env.X_ACCESS_TOKEN || '',
  accessSecret: process.env.X_ACCESS_SECRET || '',
});

// Provide a read-write client specifically for posting
const rwClient = client.readWrite;

/**
 * Sends a single tweet to X
 * @param text The content of the tweet
 * @returns The created tweet data
 */
export async function sendTweet(text: string) {
  try {
    const { data: createdTweet } = await rwClient.v2.tweet(text);
    return createdTweet;
  } catch (error) {
    console.error('X API Error:', error);
    throw error;
  }
}

export { client };
