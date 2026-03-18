import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

async function tryEndpoint(url: string, headers: any, label: string) {
  console.log(`\n--- [DEBUG] Target: ${label} ---`);
  console.log(`URL: ${url}`);
  console.log(`Headers: ${JSON.stringify({ ...headers, 'Authorization': 'Bearer [REDACTED]' }, null, 2)}`);
  
  try {
    const response = await fetch(url, { headers });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const rawId = data.id || data.sub;
      if (rawId) {
        const urn = rawId.startsWith('urn:li:person:') ? rawId : `urn:li:person:${rawId}`;
        console.log(`✅ SUCCESS: Found ID/URN -> ${urn}`);
        return urn;
      }
      console.log('⚠️  Response OK but no ID/sub found in data:', JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ FAILED:`, JSON.stringify(data, null, 2));
      // Log headers if it's a versioning error
      if (response.status === 426) {
        console.log('Backend-Header "X-LinkedIn-Error-Response":', response.headers.get('x-linkedin-error-response'));
      }
    }
  } catch (e: any) {
    console.log(`❌ ERROR: ${e.message}`);
  }
  return null;
}

async function getUrn() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    console.error('❌ LINKEDIN_ACCESS_TOKEN not found in .env');
    process.exit(1);
  }

  console.log('=== LinkedIn Debug Mode ===');
  console.log(`Token prefix: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`);

  const commonHeaders = {
    'Authorization': `Bearer ${token}`,
    'X-Restli-Protocol-Version': '2.0.0'
  };

  // List of versions to try
  const versions = ['202401', '202501', '202412'];

  for (const v of versions) {
    console.log(`\n>>> Testing with LinkedIn-Version: ${v}`);
    
    // Test identityMe (Newest)
    let urn = await tryEndpoint(
      'https://api.linkedin.com/rest/identityMe',
      { ...commonHeaders, 'LinkedIn-Version': v },
      `identityMe (${v})`
    );
    if (urn) return report(urn);

    // Test me (Standard Versioned)
    urn = await tryEndpoint(
      'https://api.linkedin.com/rest/me',
      { ...commonHeaders, 'LinkedIn-Version': v },
      `me (${v})`
    );
    if (urn) return report(urn);
  }

  // Fallback to legacy
  console.log('\n>>> Testing legacy/OIDC endpoints (no version header)');
  
  let urn = await tryEndpoint(
    'https://api.linkedin.com/v2/me',
    { 'Authorization': `Bearer ${token}` },
    'Legacy /v2/me'
  );
  if (urn) return report(urn);

  urn = await tryEndpoint(
    'https://api.linkedin.com/v2/userinfo',
    { 'Authorization': `Bearer ${token}` },
    'Legacy /v2/userinfo'
  );
  if (urn) return report(urn);

  console.log('\n❌ All debugging paths exhausted. Still no Person URN.');
}

function report(urn: string) {
  console.log('\n====================================');
  console.log('🎉 PERSON URN LOCATED');
  console.log('====================================');
  console.log(`LINKEDIN_PERSON_URN=${urn}`);
  console.log('====================================');
}

getUrn();
