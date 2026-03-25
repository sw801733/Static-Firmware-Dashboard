import type { Reference } from '../types';
import { normalizeRuleName } from './normalizer';

/**
 * Simple string similarity based on longest common substring ratio.
 */
function similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // Longest Common Subsequence length / max length
    const la = a.length;
    const lb = b.length;
    const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));

    let maxLen = 0;
    for (let i = 1; i <= la; i++) {
        for (let j = 1; j <= lb; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
                if (dp[i][j] > maxLen) maxLen = dp[i][j];
            } else {
                dp[i][j] = 0;
            }
        }
    }

    return maxLen / Math.max(la, lb);
}

/**
 * Extract the rule "family prefix" from a rule name.
 * e.g. "MISRA_C_2023_10_03" → "MISRA_C_2023_10"
 *      "CERT_C_DCL30" → "CERT_C_DCL"
 */
function rulePrefix(rule: string): string {
    const norm = normalizeRuleName(rule);
    // Remove the last segment (after last _)
    const lastUnderscore = norm.lastIndexOf('_');
    if (lastUnderscore > 0) return norm.substring(0, lastUnderscore);
    return norm;
}

export interface SimilarRule {
    ruleName: string;
    ruleNameOriginal: string;
    classification: string;
    justification: string;
    score: number;
    matchType: 'prefix' | 'similarity';
}

/**
 * Find reference rules similar to the given rule name.
 * Uses prefix matching first, then string similarity as fallback.
 */
export function findSimilarRules(
    targetRule: string,
    references: Reference[],
    maxResults: number = 5
): SimilarRule[] {
    const targetNorm = normalizeRuleName(targetRule);
    const targetPfx = rulePrefix(targetRule);

    // Deduplicate references by normalized rule name
    const seen = new Set<string>();
    const uniqueRefs: Reference[] = [];
    for (const ref of references) {
        const norm = normalizeRuleName(ref.ruleNameOriginal);
        if (norm === targetNorm) continue; // skip exact match
        if (seen.has(norm)) continue;
        seen.add(norm);
        uniqueRefs.push(ref);
    }

    const results: SimilarRule[] = [];

    // Pass 1: prefix match (same rule family)
    for (const ref of uniqueRefs) {
        const refNorm = normalizeRuleName(ref.ruleNameOriginal);
        const refPfx = rulePrefix(ref.ruleNameOriginal);
        if (refPfx === targetPfx && refNorm !== targetNorm) {
            results.push({
                ruleName: ref.ruleName,
                ruleNameOriginal: ref.ruleNameOriginal,
                classification: ref.classification,
                justification: ref.justification,
                score: 0.9, // high because same family
                matchType: 'prefix',
            });
        }
    }

    // Pass 2: string similarity (if not enough prefix matches)
    if (results.length < maxResults) {
        for (const ref of uniqueRefs) {
            const refNorm = normalizeRuleName(ref.ruleNameOriginal);
            if (results.some(r => normalizeRuleName(r.ruleNameOriginal) === refNorm)) continue;

            const sim = similarity(targetNorm, refNorm);
            if (sim >= 0.5) {
                results.push({
                    ruleName: ref.ruleName,
                    ruleNameOriginal: ref.ruleNameOriginal,
                    classification: ref.classification,
                    justification: ref.justification,
                    score: sim,
                    matchType: 'similarity',
                });
            }
        }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
}
