import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

export interface LinkedInPostResponse {
  id: string;
}

/**
 * Sends a post to LinkedIn using the 2025 versioned API.
 */
export async function postToLinkedIn(text: string, mediaUrn?: string): Promise<LinkedInPostResponse> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const authorUrn = process.env.LINKEDIN_PERSON_URN;

  if (!token || !authorUrn) {
    throw new Error('LINKEDIN_ACCESS_TOKEN or LINKEDIN_PERSON_URN missing in .env');
  }
  // Try multiple active versions as LinkedIn sunsets old versions frequently (1 yr lifetime)
  const versionsToTry = ['202604', '202603', '202602', '202601', '202512'];
  
  const bodyPayload: any = {
    author: authorUrn,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: []
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false
  };

  if (mediaUrn) {
    bodyPayload.content = {
      media: {
        id: mediaUrn
      }
    };
  }

  for (const version of versionsToTry) {
    const response = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'LinkedIn-Version': version,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyPayload)
    });

    const responseText = await response.text();

    if (response.status === 426) {
      // Version not active, try next
      console.log(`  [LinkedIn] Version ${version} not active, trying next...`);
      continue;
    }

    if (!response.ok) {
      throw new Error(`LinkedIn Posting Failed (${version}): ${response.status} ${responseText}`);
    }

    const postId = response.headers.get('x-restli-id') || responseText || 'unknown';
    return { id: postId };
  }

  throw new Error('LinkedIn Posting Failed: No active API version found.');
}
