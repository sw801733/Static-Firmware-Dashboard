/**
 * Normalize a rule name so that slight string variations in
 * the Project_Summary report vs. the classification reference
 * still produce the same key.
 *
 * Steps:
 *  1. trim
 *  2. collapse consecutive whitespace → single space
 *  3. uppercase (English letters)
 *  4. normalize colons (full-width → half-width)
 *  5. normalize hyphens (en-dash, em-dash → ASCII hyphen)
 *  6. remove leading/trailing hyphens/colons
 */
export function normalizeRuleName(rule: string): string {
    return rule
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase()
        // full-width colon → half-width
        .replace(/\uff1a/g, ':')
        // en-dash / em-dash → hyphen
        .replace(/[\u2013\u2014]/g, '-')
        // strip leading/trailing special chars
        .replace(/^[-:\s]+|[-:\s]+$/g, '');
}
