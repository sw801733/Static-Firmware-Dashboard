import type { WorkTask, CompareResult, RulesetReport, Reference, TaskType } from '../types';
import { normalizeRuleName } from './normalizer';
import { computePriorityScore, hasReferenceForRule, buildHotspotRuleSet } from './scoring';

/**
 * Auto-generate work tasks from analysis results.
 *
 * Task generation rules:
 * - New Rule + no reference → "Reference writing required"
 * - Remaining increased significantly → "Rule increase investigation required"
 * - Rule appears frequently in hotspot files → "Priority inspection recommended"
 */
export function generateWorkTasks(
    sessionId: string,
    compareResult: CompareResult,
    currentReports: RulesetReport[],
    references: Reference[]
): WorkTask[] {
    const tasks: WorkTask[] = [];
    const now = Date.now();
    const hotspotRules = buildHotspotRuleSet(currentReports);

    // Determine ruleset from reports
    const defaultRuleset = currentReports[0]?.ruleset || 'Unknown';

    // Track which rules already have tasks to avoid duplicates
    const taskRules = new Set<string>();

    // 1. New Rules without reference → REF_NEEDED
    for (const rule of compareResult.newRules) {
        const norm = normalizeRuleName(rule.rule);
        const noRef = !hasReferenceForRule(rule.rule, references);
        const isHotspot = hotspotRules.has(norm);

        const score = computePriorityScore({
            remainingDelta: rule.remaining,
            remainingTotal: rule.remaining,
            isNew: true,
            noReference: noRef,
            isHotspot,
        });

        if (noRef) {
            tasks.push({
                rule: rule.rule,
                ruleset: defaultRuleset,
                sessionId,
                taskType: 'REF_NEEDED',
                priorityScore: score,
                status: 'TODO',
                createdAt: now,
            });
            taskRules.add(norm);
        }
    }

    // 2. Increased Rules (significant increase: delta >= 3) → INCREASE_INVESTIGATION
    for (const rd of compareResult.increasedRules) {
        const norm = normalizeRuleName(rd.rule);
        if (taskRules.has(norm)) continue; // skip if already covered
        if (rd.delta < 3) continue; // only significant increases

        const noRef = !hasReferenceForRule(rd.rule, references);
        const isHotspot = hotspotRules.has(norm);

        const score = computePriorityScore({
            remainingDelta: rd.delta,
            remainingTotal: rd.currentRemaining,
            isNew: false,
            noReference: noRef,
            isHotspot,
        });

        tasks.push({
            rule: rd.rule,
            ruleset: defaultRuleset,
            sessionId,
            taskType: 'INCREASE_INVESTIGATION',
            priorityScore: score,
            status: 'TODO',
            createdAt: now,
        });
        taskRules.add(norm);
    }

    // 3. Hotspot rules without reference → PRIORITY_INSPECTION
    for (const norm of hotspotRules) {
        if (taskRules.has(norm)) continue;

        // Find the rule in current reports
        let totalRemaining = 0;
        let ruleName = norm;
        for (const r of currentReports) {
            for (const rule of r.rules) {
                if (normalizeRuleName(rule.rule) === norm) {
                    totalRemaining += rule.remaining;
                    ruleName = rule.rule; // use original name
                }
            }
        }

        if (totalRemaining === 0) continue;

        const noRef = !hasReferenceForRule(ruleName, references);
        const score = computePriorityScore({
            remainingDelta: 0,
            remainingTotal: totalRemaining,
            isNew: false,
            noReference: noRef,
            isHotspot: true,
        });

        // Only generate task if score is high enough
        if (score >= 30) {
            tasks.push({
                rule: ruleName,
                ruleset: defaultRuleset,
                sessionId,
                taskType: 'PRIORITY_INSPECTION',
                priorityScore: score,
                status: 'TODO',
                createdAt: now,
            });
            taskRules.add(norm);
        }
    }

    // Sort by priority descending
    tasks.sort((a, b) => b.priorityScore - a.priorityScore);
    return tasks;
}

export const TASK_TYPE_LABELS: Record<TaskType, { label: string; icon: string }> = {
    'REF_NEEDED': { label: '레퍼런스 작성 필요', icon: '📝' },
    'INCREASE_INVESTIGATION': { label: '규칙 증가 조사 필요', icon: '🔍' },
    'PRIORITY_INSPECTION': { label: '우선 점검 권고', icon: '⚠️' },
};
