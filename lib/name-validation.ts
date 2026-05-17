/**
 * Shared name validation and sanitization module.
 *
 * Provides input validation (reject malicious names at registration) and
 * defense-in-depth sanitization (strip dangerous patterns before email rendering).
 *
 * Allows legitimate names: letters, spaces, common punctuation (. , ' -),
 * and non-Latin scripts (Arabic, CJK, Javanese, etc.).
 */

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Matches http:// or https:// URLs */
const URL_PATTERN = /https?:\/\/[^\s]+/i;

/** Matches www. prefixed URLs */
const WWW_PATTERN = /www\.[^\s]+/i;

/** Matches HTML/XML tags: <tagname ...> or </tagname> */
const HTML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/;

/**
 * Matches standalone domain patterns like evil.com, phishing.net, scam.org
 * but NOT legitimate name patterns like "Dr." or "Jr." or initials like "R.A."
 *
 * Strategy: match word.tld where the word before the dot is 3+ chars
 * (to avoid matching "Dr.", "Jr.", "Sr.", "St.", "Mr.", "Ms.") and the TLD
 * is a known pattern. Also requires the domain to NOT be preceded by common
 * name prefixes.
 */
const DOMAIN_PATTERN = /(?<![A-Z]\.)\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(com|net|org|io|xyz|info|biz|co|me|dev|app|site|online|tech|[a-z]{2})(?:\/[^\s]*)?/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ERROR_MESSAGE = "Nama tidak valid. Silakan gunakan nama asli Anda.";

/**
 * Validates a user name, rejecting names that contain URL patterns,
 * HTML tags, or standalone domain patterns.
 *
 * Allows legitimate names with periods (Dr. Smith), hyphens (Jean-Pierre),
 * apostrophes (O'Brien), commas (Smith, Jr.), and non-Latin scripts.
 */
export function validateName(name: string): ValidationResult {
  if (!name || !name.trim()) {
    return { valid: false, error: ERROR_MESSAGE };
  }

  // Check for URL patterns (http:// or https://)
  if (URL_PATTERN.test(name)) {
    return { valid: false, error: ERROR_MESSAGE };
  }

  // Check for www. patterns
  if (WWW_PATTERN.test(name)) {
    return { valid: false, error: ERROR_MESSAGE };
  }

  // Check for HTML tags
  if (HTML_TAG_PATTERN.test(name)) {
    return { valid: false, error: ERROR_MESSAGE };
  }

  // Check for standalone domain patterns
  // We need to be careful not to reject names like "Dr. Smith" or "R.A. Kartini"
  if (containsDomainPattern(name)) {
    return { valid: false, error: ERROR_MESSAGE };
  }

  return { valid: true };
}

/**
 * Checks if a name contains a standalone domain pattern while allowing
 * legitimate name patterns with periods.
 *
 * Legitimate patterns (allowed):
 * - "Dr. Smith" — short prefix + period + space
 * - "R.A. Kartini" — initials with periods
 * - "Jr." / "Sr." — suffixes
 * - "St. John" — abbreviations
 *
 * Rejected patterns:
 * - "evil.com" — domain with TLD
 * - "phishing.net/verify" — domain with path
 * - "scam-site.org" — hyphenated domain
 */
function containsDomainPattern(name: string): boolean {
  const match = name.match(DOMAIN_PATTERN);
  if (!match) return false;

  const domain = match[0];
  const matchIndex = match.index ?? 0;

  // If the part before the dot is 1-2 characters, it's likely an initial/abbreviation
  // e.g., "R.A." or "Dr." — but we already handle "Dr." via the regex lookbehind
  const beforeDot = domain.split(".")[0];
  if (beforeDot.length <= 2) {
    // Check if it looks like an initial (single uppercase letter or two letters)
    // vs a short domain like "go.id" or "co.uk"
    const charBeforeMatch = matchIndex > 0 ? name[matchIndex - 1] : " ";
    // If preceded by a space or start of string, and the part is short,
    // check if it's all uppercase (initial) vs lowercase (domain)
    if (/^[A-Z]{1,2}$/i.test(beforeDot) && (charBeforeMatch === " " || charBeforeMatch === "." || matchIndex === 0)) {
      // Could be an initial like "R.A" — check if followed by period+space or end
      const afterMatch = name.substring(matchIndex + domain.length);
      if (afterMatch === "" || afterMatch.startsWith(" ") || afterMatch.startsWith(".")) {
        // Likely an abbreviation/initial if uppercase
        if (/^[A-Z]{1,2}$/.test(beforeDot)) {
          return false;
        }
      }
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Sanitization (defense-in-depth)
// ---------------------------------------------------------------------------

/**
 * Strips dangerous patterns from a name as a defense-in-depth layer.
 * Used in email rendering even if validation passes (e.g., for existing
 * users who registered before validation was added).
 *
 * Removes:
 * - URLs (http://, https://, www.)
 * - HTML tags
 * - Standalone domain patterns
 *
 * Returns the cleaned name with extra whitespace collapsed.
 */
export function sanitizeName(name: string): string {
  let sanitized = name;

  // Remove HTML tags FIRST (before URL stripping, since tags may contain URLs in attributes)
  sanitized = sanitized.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  // Remove URLs (http:// and https://)
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, "");

  // Remove www. patterns
  sanitized = sanitized.replace(/www\.[^\s]+/gi, "");

  // Remove standalone domain patterns (careful not to strip legitimate periods)
  sanitized = sanitized.replace(
    /(?<![A-Z]\.)\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(com|net|org|io|xyz|info|biz|co|me|dev|app|site|online|tech|[a-z]{2})(?:\/[^\s]*)?/gi,
    (match, _tld, _offset) => {
      // Preserve if it looks like an abbreviation (1-2 uppercase chars before dot)
      const beforeDot = match.split(".")[0];
      if (/^[A-Z]{1,2}$/.test(beforeDot)) {
        return match;
      }
      return "";
    }
  );

  // Collapse multiple spaces and trim
  sanitized = sanitized.replace(/\s{2,}/g, " ").trim();

  return sanitized;
}
