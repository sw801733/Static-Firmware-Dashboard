import type { RulesetReport, RulesetCompareResult, RuleSummary, RuleDelta } from '../types';
import { normalizeRuleName } from './normalizer';

/**
 * Per-ruleset comparison between two sessions.
 * Groups reports by ruleset name, then compares rules within each group.
 */
export function computeRulesetComparison(
    currentReports: RulesetReport[],
    previousReports: RulesetReport[]
): RulesetCompareResult[] {
    // Collect all ruleset names
    const rulesetNames = new Set<string>();
    currentReports.forEach(r => rulesetNames.add(r.ruleset));
    previousReports.forEach(r => rulesetNames.add(r.ruleset));

    const results: RulesetCompareResult[] = [];

    for (const ruleset of rulesetNames) {
        const curReport = currentReports.find(r => r.ruleset === ruleset);
        const prevReport = previousReports.find(r => r.ruleset === ruleset);

        const curRules = curReport?.rules ?? [];
        const prevRules = prevReport?.rules ?? [];

        // Build maps
        const curMap = new Map<string, { remaining: number; suppressed: number }>();
        for (const rule of curRules) {
            const key = normalizeRuleName(rule.rule);
            const e = curMap.get(key) || { remaining: 0, suppressed: 0 };
            curMap.set(key, { remaining: e.remaining + rule.remaining, suppressed: e.suppressed + rule.suppressed });
        }
        const prevMap = new Map<string, { remaining: number; suppressed: number }>();
        for (const rule of prevRules) {
            const key = normalizeRuleName(rule.rule);
            const e = prevMap.get(key) || { remaining: 0, suppressed: 0 };
            prevMap.set(key, { remaining: e.remaining + rule.remaining, suppressed: e.suppressed + rule.suppressed });
        }

        const newRules: RuleSummary[] = [];
        const increased: RuleDelta[] = [];
        const decreased: RuleDelta[] = [];

        for (const [key, cur] of curMap) {
            const prev = prevMap.get(key);
            if (!prev) {
                newRules.push({ rule: key, remaining: cur.remaining, suppressed: cur.suppressed });
            } else {
                const delta = cur.remaining - prev.remaining;
                if (delta > 0) {
                    increased.push({ rule: key, currentRemaining: cur.remaining, previousRemaining: prev.remaining, delta, currentSuppressed: cur.suppressed, previousSuppressed: prev.suppressed });
                } else if (delta < 0) {
                    decreased.push({ rule: key, currentRemaining: cur.remaining, previousRemaining: prev.remaining, delta, currentSuppressed: cur.suppressed, previousSuppressed: prev.suppressed });
                }
            }
        }

        increased.sort((a, b) => b.delta - a.delta);
        decreased.sort((a, b) => a.delta - b.delta);

        const curRemaining = curReport?.rulesetSummary.remaining ?? 0;
        const prevRemaining = prevReport?.rulesetSummary.remaining ?? 0;
        const curSuppressed = curReport?.rulesetSummary.suppressed ?? 0;
        const prevSuppressed = prevReport?.rulesetSummary.suppressed ?? 0;

        results.push({
            ruleset,
            currentRemaining: curRemaining,
            previousRemaining: prevRemaining,
            remainingDelta: curRemaining - prevRemaining,
            currentSuppressed: curSuppressed,
            previousSuppressed: prevSuppressed,
            suppressedDelta: curSuppressed - prevSuppressed,
            newRules,
            topIncreased: increased.slice(0, 5),
            topDecreased: decreased.slice(0, 5),
        });
    }

    // Sort by absolute remaining delta descending
    results.sort((a, b) => Math.abs(b.remainingDelta) - Math.abs(a.remainingDelta));
    return results;
}
