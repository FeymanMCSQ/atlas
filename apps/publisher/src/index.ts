/**
 * @atlas/publisher
 *
 * Publishing service for Atlas.
 * Converts approved drafts into platform-specific payloads and sends them.
 */

export { formatDraftForPlatform, type PlatformPayload, type XPayload, type LinkedInPayload } from './formatter.js';
export { handlePublishRequested } from './publish-handler.js';
