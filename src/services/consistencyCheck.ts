import type { RulesetReport, ConsistencyCheck } from '../types';

/**
 * Validate that LOC, totalFiles, analyzedFiles, and totalFunctions
 * are consistent across rulesets within a single session.
 *
 * These values represent the same analyzed codebase, so they
 * should NOT be summed — they should all be the same.
 */
export function checkConsistency(reports: RulesetReport[]): ConsistencyCheck[] {
    if (reports.length === 0) return [];

    const fields: { field: ConsistencyCheck['field']; label: string; extract: (r: RulesetReport) => number }[] = [
        { field: 'loc', label: 'Lines of Code', extract: r => r.summary.lineOfCode },
        { field: 'totalFiles', label: 'Total Files', extract: r => r.summary.totalFiles },
        { field: 'analyzedFiles', label: 'Analyzed Files', extract: r => r.summary.analyzedFiles },
        { field: 'totalFunctions', label: 'Total Functions', extract: r => r.summary.totalFunctions },
    ];

    return fields.map(({ field, label, extract }) => {
        const values = reports.map(extract);
        const uniqueValues = new Set(values);
        const isConsistent = uniqueValues.size <= 1;
        return {
            field,
            label,
            isConsistent,
            values,
            displayValue: values[0] ?? 0,
        };
    });
}

/**
 * Get deduplicated session-level values, taking the first ruleset's value
 * for fields that should NOT be summed.
 */
export function getDeduplicatedSessionValues(reports: RulesetReport[]): {
    remaining: number;
    suppressed: number;
    loc: number;
    functions: number;
    totalFiles: number;
    analyzedFiles: number;
    locConsistent: boolean;
    functionsConsistent: boolean;
    totalFilesConsistent: boolean;
    analyzedFilesConsistent: boolean;
} {
    if (reports.length === 0) {
        return { remaining: 0, suppressed: 0, loc: 0, functions: 0, totalFiles: 0, analyzedFiles: 0, locConsistent: true, functionsConsistent: true, totalFilesConsistent: true, analyzedFilesConsistent: true };
    }

    // Sum across rulesets (correct for violation counts)
    const remaining = reports.reduce((s, r) => s + r.rulesetSummary.remaining, 0);
    const suppressed = reports.reduce((s, r) => s + r.rulesetSummary.suppressed, 0);

    // Deduplicate (take first value, check consistency)
    const locValues = reports.map(r => r.summary.lineOfCode);
    const funcValues = reports.map(r => r.summary.totalFunctions);
    const totalFileValues = reports.map(r => r.summary.totalFiles);
    const analyzedFileValues = reports.map(r => r.summary.analyzedFiles);

    return {
        remaining,
        suppressed,
        loc: locValues[0],
        functions: funcValues[0],
        totalFiles: totalFileValues[0],
        analyzedFiles: analyzedFileValues[0],
        locConsistent: new Set(locValues).size <= 1,
        functionsConsistent: new Set(funcValues).size <= 1,
        totalFilesConsistent: new Set(totalFileValues).size <= 1,
        analyzedFilesConsistent: new Set(analyzedFileValues).size <= 1,
    };
}
