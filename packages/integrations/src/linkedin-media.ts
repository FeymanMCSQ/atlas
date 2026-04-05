import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

/**
 * Downloads a raw image buffer from an internet URL.
 */
async function downloadImageBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download media at ${url}: ${response.status}`);
  }
  return await response.arrayBuffer();
}

/**
 * Executes the 3-step LinkedIn image upload process and returns the final urn:li:image.
 */
export async function uploadImageToLinkedIn(imageUrl: string): Promise<string> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const authorUrn = process.env.LINKEDIN_PERSON_URN;
  
  // LinkedIn sunsets versions precisely after 1 year. Current year is 2026.
  const versions = ['202604', '202603', '202602', '202601', '202512'];

  if (!token || !authorUrn) {
    throw new Error('LINKEDIN_ACCESS_TOKEN or LINKEDIN_PERSON_URN missing in .env');
  }

  // 1. Download binary buffer
  const imageBuffer = await downloadImageBuffer(imageUrl);

  let uploadUrl = '';
  let mediaUrn = '';
  let activeVersion = '';

  // 2. Initialize Upload Request with version fallback loop
  for (const version of versions) {
    const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'LinkedIn-Version': version,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: authorUrn
        }
      })
    });

    if (initRes.status === 426) continue;

    if (!initRes.ok) {
      throw new Error(`LinkedIn Image Init Failed [${version}]: ${initRes.status} ${await initRes.text()}`);
    }

    const initData = await initRes.json();
    uploadUrl = initData.value.uploadUrl;
    mediaUrn = initData.value.image;
    activeVersion = version;
    break;
  }

  if (!uploadUrl) {
    throw new Error(`LinkedIn Image Init Failed: No active API version found in 2026.`);
  }

  // 3. PUT the binary buffer into LinkedIn's bucket
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream'
    },
    body: imageBuffer
  });

  if (!putRes.ok && putRes.status !== 201) {
     throw new Error(`LinkedIn Binary PUT Failed: ${putRes.status} ${await putRes.text()}`);
  }

  return mediaUrn;
}
