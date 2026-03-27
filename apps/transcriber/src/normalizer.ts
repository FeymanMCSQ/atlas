/**
 * Atlas Transcriber - Normalization Utility
 * 
 * Cleans the raw transcript text by removing timestamps and common conversational fillers 
 * before persistence.
 */
export function cleanTranscriptText(rawText: string): string {
  if (!rawText) return '';

  let cleaned = rawText;

  // 1. Remove timestamps:
  // e.g. [00:15], (01:23:45), 00:00
  const timestampRegex = /[\[\(]?\b(?:\d{1,2}:)?\d{2}:\d{2}\b[\]\)]?/g;
  cleaned = cleaned.replace(timestampRegex, '');

  // 2. Remove filler words 
  // We strictly target unambiguous filler words to prevent accidentally mutating 
  // sentence meaning (e.g. we omit 'like' unless it's strictly a filler).
  const fillers = ['um', 'uh', 'ah', 'hmm', 'you know'];
  const fillerRegex = new RegExp(`\\b(${fillers.join('|')})\\b`, 'gi');
  cleaned = cleaned.replace(fillerRegex, '');

  // Clean empty parentheses or brackets left behind if a timestamp was the only contents
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  cleaned = cleaned.replace(/\[\s*\]/g, '');

  // Normalize multi-spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove whitespace strictly before punctuation
  cleaned = cleaned.replace(/\s+([,\.!\?])/g, '$1');

  // Safely handle multiple adjacent commas (e.g., from "word, um, word" -> "word,, word")
  cleaned = cleaned.replace(/,+/g, ',');

  // Strip leading punctuation and whitespace
  cleaned = cleaned.replace(/^[\s,\.]+/, '');

  return cleaned.trim();
}
