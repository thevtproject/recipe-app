// Minimal text sanitizer — strips HTML tags and decodes common entities.
// Used as a zod .transform() on recipe text fields to prevent stored XSS
// in case someone adds markdown/rich-text rendering in the future.
//
// We do NOT need a full HTML parser (DOMPurify etc.) because all recipe
// fields are plain text — no formatting is expected.

const HTML_TAG_RE = /<[^>]*>/g;

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&#x2F;': '/',
};

/** Strip HTML tags and decode common HTML entities. */
export function sanitizeText(raw: string): string {
  let cleaned = raw.replace(HTML_TAG_RE, '');
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    cleaned = cleaned.replaceAll(entity, char);
  }
  return cleaned.trim();
}
