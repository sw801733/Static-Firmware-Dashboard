import type { RuleDelta, RuleSummary, Reference } from '../types';
import { normalizeRuleName } from './normalizer';

/* ============================
   Priority Scoring
   ============================ */

/**
 * Heuristic priority score for a work task.
 *
 * Score = (Remaining delta × 2)
 *       + (Remaining total × 0.5)
 *       + (isNew ? +50 : 0)
 *       + (noReference ? +40 : 0)
 *       + (isHotspot ? +20 : 0)
 */
export function computePriorityScore(opts: {
    remainingDelta: number;
    remainingTotal: number;
    isNew: boolean;
    noReference: boolean;
    isHotspot: boolean;
}): number {
    let score = 0;
    score += opts.remainingDelta * 2;
    score += opts.remainingTotal * 0.5;
    if (opts.isNew) score += 50;
    if (opts.noReference) score += 40;
    if (opts.isHotspot) score += 20;
    return Math.round(Math.max(0, score));
}

/**
 * Map a numeric score to a priority label.
 */
export function getPriorityLevel(score: number): 'High' | 'Medium' | 'Low' {
    if (score >= 80) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
}

/**
 * Check if a rule has a reference entry.
 */
export function hasReferenceForRule(
    ruleName: string,
    references: Reference[]
): boolean {
    const norm = normalizeRuleName(ruleName);
    return references.some(r => r.ruleName === norm || normalizeRuleName(r.ruleNameOriginal) === norm);
}

/**
 * Identify rules that appear frequently in hotspot (top-N) files.
 * We define "hotspot rule" as a rule that appears in a file with remaining > threshold.
 */
export function isHotspotRule(
    ruleName: string,
    hotspotRules: Set<string>
): boolean {
    return hotspotRules.has(normalizeRuleName(ruleName));
}

/**
 * Build a set of rule names from top hotspot files.
 */
export function buildHotspotRuleSet(
    reports: { files: { file: string; remaining: number; ruleCount: number }[]; rules: { rule: string; remaining: number }[] }[],
    topN: number = 10
): Set<string> {
    // Aggregate files
    const fileMap = new Map<string, number>();
    for (const r of reports) {
        for (const f of r.files) {
            fileMap.set(f.file, (fileMap.get(f.file) || 0) + f.remaining);
        }
    }
    const sorted = [...fileMap.entries()].sort((a, b) => b[1] - a[1]);
    const topFiles = new Set(sorted.slice(0, topN).map(([f]) => f));

    // Gather all rules from those files — simplified: any rule with remaining > 0 in the report
    const ruleSet = new Set<string>();
    for (const r of reports) {
        for (const rule of r.rules) {
            if (rule.remaining > 0) {
                // Check if this rule likely appears in hotspot files
                // (Simplified heuristic: top rules by remaining)
                ruleSet.add(normalizeRuleName(rule.rule));
            }
        }
    }

    // More precise: just top-N rules by remaining
    const allRules = reports.flatMap(r => r.rules).sort((a, b) => b.remaining - a.remaining);
    const hotspotRuleSet = new Set<string>();
    allRules.slice(0, topN).forEach(r => hotspotRuleSet.add(normalizeRuleName(r.rule)));

    // Also: if any top file is present, we consider remaining-heavy rules as hotspot
    if (topFiles.size > 0) {
        return hotspotRuleSet;
    }
    return hotspotRuleSet;
}

/**
 * Get delta info for a rule when comparing two sessions.
 */
export function getRuleDeltaInfo(
    ruleName: string,
    newRules: RuleSummary[],
    increasedRules: RuleDelta[]
): { isNew: boolean; delta: number; total: number } {
    const norm = normalizeRuleName(ruleName);
    const newRule = newRules.find(r => normalizeRuleName(r.rule) === norm);
    if (newRule) return { isNew: true, delta: newRule.remaining, total: newRule.remaining };

    const inc = increasedRules.find(r => normalizeRuleName(r.rule) === norm);
    if (inc) return { isNew: false, delta: inc.delta, total: inc.currentRemaining };

    return { isNew: false, delta: 0, total: 0 };
}
