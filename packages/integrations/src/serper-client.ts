/**
 * serper-client.ts — SHIM
 *
 * Serper.dev has been replaced by Brave Search API.
 * This file re-exports from brave-client.ts so any lingering imports
 * continue to work without changes.
 *
 * All new code should import from brave-client.ts directly.
 */
export { searchGoogleImages, searchGoogleNews, searchGoogle } from './brave-client.js';
