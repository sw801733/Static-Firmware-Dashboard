import type { RulesetReport, Highlight, FileDelta, CompareResult } from '../types';

/* ============================
   Highlights Detection
   ============================ */

/**
 * Detect key highlights from a compare result.
 */
export function computeHighlights(
    result: CompareResult,
    currentReports: RulesetReport[],
    previousReports: RulesetReport[]
): Highlight[] {
    const highlights: Highlight[] = [];

    // 1. Top Increased Rule
    if (result.increasedRules.length > 0) {
        const top = result.increasedRules[0];
        highlights.push({
            type: 'top-increased',
            name: top.rule,
            delta: top.delta,
            explanation: `가장 많이 증가한 규칙. ${top.previousRemaining} → ${top.currentRemaining} (+${top.delta})`,
        });
    }

    // 2. Top Decreased Rule
    if (result.decreasedRules.length > 0) {
        const top = result.decreasedRules[0];
        highlights.push({
            type: 'top-decreased',
            name: top.rule,
            delta: top.delta,
            explanation: `가장 많이 감소한 규칙. ${top.previousRemaining} → ${top.currentRemaining} (${top.delta})`,
        });
    }

    // 3. Largest File Violation Increase
    const fileDeltas = computeFileDelta(currentReports, previousReports);
    const topFileInc = fileDeltas.filter(f => f.remainingDelta > 0).sort((a, b) => b.remainingDelta - a.remainingDelta)[0];
    if (topFileInc) {
        highlights.push({
            type: 'file-spike',
            name: topFileInc.file,
            delta: topFileInc.remainingDelta,
            explanation: `파일별 위배 증가 1위. ${topFileInc.previousRemaining} → ${topFileInc.currentRemaining} (+${topFileInc.remainingDelta})`,
        });
    }

    // 4. Suppressed spike
    const totalCurSup = currentReports.reduce((s, r) => s + r.rulesetSummary.suppressed, 0);
    const totalPrevSup = previousReports.reduce((s, r) => s + r.rulesetSummary.suppressed, 0);
    const supDelta = totalCurSup - totalPrevSup;
    if (Math.abs(supDelta) > 5) {
        highlights.push({
            type: 'suppressed-spike',
            name: 'Suppressed',
            delta: supDelta,
            explanation: supDelta > 0
                ? `Suppressed 건수 ${supDelta}건 증가 (${totalPrevSup} → ${totalCurSup}). 규칙 억제 처리 확인 필요.`
                : `Suppressed 건수 ${Math.abs(supDelta)}건 감소 (${totalPrevSup} → ${totalCurSup}). 억제 해제 또는 코드 수정 반영.`,
        });
    }

    return highlights;
}

/* ============================
   File-Level Comparison
   ============================ */

/**
 * Compute per-file remaining and ruleCount deltas between two sessions.
 */
export function computeFileDelta(
    currentReports: RulesetReport[],
    previousReports: RulesetReport[],
    topN: number = 20
): FileDelta[] {
    // Aggregate current files
    const curMap = new Map<string, { remaining: number; ruleCount: number }>();
    for (const r of currentReports) {
        for (const f of r.files) {
            const existing = curMap.get(f.file) || { remaining: 0, ruleCount: 0 };
            existing.remaining += f.remaining;
            existing.ruleCount += f.ruleCount;
            curMap.set(f.file, existing);
        }
    }

    // Aggregate previous files
    const prevMap = new Map<string, { remaining: number; ruleCount: number }>();
    for (const r of previousReports) {
        for (const f of r.files) {
            const existing = prevMap.get(f.file) || { remaining: 0, ruleCount: 0 };
            existing.remaining += f.remaining;
            existing.ruleCount += f.ruleCount;
            prevMap.set(f.file, existing);
        }
    }

    // Previous top-N files
    const prevSorted = [...prevMap.entries()].sort((a, b) => b[1].remaining - a[1].remaining);
    const prevTopSet = new Set(prevSorted.slice(0, topN).map(([f]) => f));

    // Build deltas
    const allFiles = new Set([...curMap.keys(), ...prevMap.keys()]);
    const deltas: FileDelta[] = [];

    for (const file of allFiles) {
        const cur = curMap.get(file) || { remaining: 0, ruleCount: 0 };
        const prev = prevMap.get(file) || { remaining: 0, ruleCount: 0 };

        deltas.push({
            file,
            currentRemaining: cur.remaining,
            previousRemaining: prev.remaining,
            remainingDelta: cur.remaining - prev.remaining,
            currentRuleCount: cur.ruleCount,
            previousRuleCount: prev.ruleCount,
            ruleCountDelta: cur.ruleCount - prev.ruleCount,
            isNewInTop: !prevTopSet.has(file) && cur.remaining > 0,
        });
    }

    // Sort by remaining delta descending
    deltas.sort((a, b) => b.remainingDelta - a.remainingDelta);
    return deltas.slice(0, topN);
}
