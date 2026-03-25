import * as XLSX from 'xlsx';
import type { ParsedProjectReport, ParsedReference, SummaryData, RulesetSummary, RuleSummary, FileSummary } from '../types';
import { normalizeRuleName } from './normalizer';

/* ============================
   Helpers
   ============================ */

function str(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

function num(v: unknown): number {
    if (v === null || v === undefined || v === '') return 0;
    // Handle comma-separated numbers like "1,177"
    const cleaned = String(v).replace(/,/g, '').trim();
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
}

type Row = unknown[];

function sheetToRows(wb: XLSX.WorkBook, sheetName: string): Row[] {
    const candidates = wb.SheetNames.filter(
        n => n.trim().toUpperCase() === sheetName.toUpperCase()
    );
    if (candidates.length === 0) return [];
    const ws = wb.Sheets[candidates[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1 }) as Row[];
}

/**
 * Find the header row by scanning for a row that contains a specific marker text in any cell.
 * Returns the row index, or -1 if not found.
 */
function findHeaderRow(rows: Row[], marker: string): number {
    const upperMarker = marker.toUpperCase();
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        for (const cell of row as unknown[]) {
            if (str(cell).toUpperCase() === upperMarker) return i;
        }
    }
    return -1;
}

/**
 * Find which column index has the given header text.
 * Case-insensitive, trims whitespace.
 */
function findCol(headerRow: Row, ...candidates: string[]): number {
    if (!headerRow) return -1;
    for (let i = 0; i < (headerRow as unknown[]).length; i++) {
        const val = str(headerRow[i]).toUpperCase();
        for (const c of candidates) {
            if (val === c.toUpperCase()) return i;
        }
    }
    return -1;
}

/**
 * In the real format, the actual data has "Remaining" and "Suppressed" in a
 * sub-header row (the row below the main header). We need to find columns
 * by looking at BOTH the header row AND the sub-header row.
 */
function findColInRows(rows: Row[], rowIdx: number, ...candidates: string[]): number {
    // Check in the header row first
    const idx = findCol(rows[rowIdx], ...candidates);
    if (idx !== -1) return idx;
    // Check in the sub-header row (row below)
    if (rowIdx + 1 < rows.length) {
        return findCol(rows[rowIdx + 1], ...candidates);
    }
    return -1;
}

/**
 * Extract a key-value from the Summary sheet (key in col1, value in col3).
 */
function getKV(rows: Row[], key: string): string {
    const upperKey = key.toUpperCase();
    for (const row of rows) {
        if (!row) continue;
        const cells = row as unknown[];
        // Check col 0, 1, 2 for the key
        for (let c = 0; c < Math.min(3, cells.length); c++) {
            if (str(cells[c]).toUpperCase() === upperKey) {
                // Return value from col 2 or col 3 (whichever has data)
                for (let v = c + 1; v < cells.length; v++) {
                    const val = str(cells[v]);
                    if (val) return val;
                }
            }
        }
    }
    return '';
}

/**
 * Parse "Source: 10 / Header: 163" → extract the first number or total.
 * Also handles plain numbers like "25" or "1,177".
 */
function parseFileCount(val: string): number {
    if (!val) return 0;
    // Try plain number first
    const plain = num(val);
    if (plain > 0) return plain;
    // Try "Source: X / Header: Y" pattern → return X + Y
    const match = val.match(/Source:\s*(\d+)\s*\/\s*Header:\s*(\d+)/i);
    if (match) return parseInt(match[1]) + parseInt(match[2]);
    // Try to extract just the first number
    const numMatch = val.match(/(\d+)/);
    return numMatch ? parseInt(numMatch[1]) : 0;
}

function isDataRow(row: Row): boolean {
    if (!row) return false;
    const cells = row as unknown[];
    // Skip empty rows and copyright rows
    const nonEmpty = cells.filter(c => str(c) !== '');
    if (nonEmpty.length === 0) return false;
    const joined = cells.map(c => str(c)).join(' ').toLowerCase();
    if (joined.includes('copyright')) return false;
    return true;
}

/* ============================
   Parse Project Summary Report
   ============================ */

export async function parseProjectSummary(file: File): Promise<ParsedProjectReport> {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);

    // --- Summary sheet (key-value format) ---
    const summaryRows = sheetToRows(wb, 'Summary');

    const analysis = getKV(summaryRows, 'Analysis') || '#?';
    const totalFilesRaw = getKV(summaryRows, 'Total Files');
    const analyzedFilesRaw = getKV(summaryRows, 'Analyzed Files');
    const totalFunctionsRaw = getKV(summaryRows, 'Total Functions');
    const locRaw = getKV(summaryRows, 'Line Of Code');

    const summary: SummaryData = {
        analysis,
        totalFiles: parseFileCount(totalFilesRaw),
        analyzedFiles: parseFileCount(analyzedFilesRaw),
        totalFunctions: num(totalFunctionsRaw),
        lineOfCode: num(locRaw),
    };

    // --- Extract ruleset name from Summary sheet ---
    let rulesetName = 'Unknown';
    // Look for the RuleSet row in Summary (e.g. Row 23: ["","SDV1_TEST_MISRA_C_2023",...])
    const rulesetHeaderIdx = findHeaderRow(summaryRows, 'RuleSet');
    if (rulesetHeaderIdx !== -1 && rulesetHeaderIdx + 1 < summaryRows.length) {
        const nextRow = summaryRows[rulesetHeaderIdx + 1];
        if (nextRow) {
            for (const cell of nextRow as unknown[]) {
                const val = str(cell);
                if (val && val !== '' && !val.includes('Copyright')) {
                    rulesetName = val;
                    break;
                }
            }
        }
    }

    // --- RuleSet sheet ---
    const rsRows = sheetToRows(wb, 'RuleSet');
    const rulesetSummary: RulesetSummary = { ruleset: rulesetName, remaining: 0, suppressed: 0 };

    if (rsRows.length > 0) {
        // Find header row (contains "RuleSet" or "Ruleset")
        const hdrIdx = findHeaderRow(rsRows, 'RuleSet');
        if (hdrIdx !== -1) {
            // Find Remaining and Suppressed columns (may be in header row or subheader row)
            const iRem = findColInRows(rsRows, hdrIdx, 'Remaining', 'Defect');
            const iSup = findColInRows(rsRows, hdrIdx, 'Suppressed');
            const iRS = findCol(rsRows[hdrIdx], 'RuleSet', 'Ruleset');

            // Data rows start after header + sub-header
            const dataStart = hdrIdx + 2;
            for (let r = dataStart; r < rsRows.length; r++) {
                const row = rsRows[r];
                if (!isDataRow(row)) continue;
                const cells = row as unknown[];

                // Get ruleset name
                if (iRS !== -1 && str(cells[iRS])) {
                    rulesetName = str(cells[iRS]);
                    rulesetSummary.ruleset = rulesetName;
                }
                rulesetSummary.remaining += num(cells[iRem]);
                rulesetSummary.suppressed += num(cells[iSup]);
            }
        }
    }

    // --- Rule sheet ---
    const ruleRows = sheetToRows(wb, 'Rule');
    const rules: RuleSummary[] = [];

    if (ruleRows.length > 0) {
        const hdrIdx = findHeaderRow(ruleRows, 'Rule');
        if (hdrIdx !== -1) {
            const iRule = findCol(ruleRows[hdrIdx], 'Rule');
            const iRem = findColInRows(ruleRows, hdrIdx, 'Remaining');
            const iSup = findColInRows(ruleRows, hdrIdx, 'Suppressed');
            // Also check for RuleSet column (may exist)
            const iRS = findCol(ruleRows[hdrIdx], 'RuleSet', 'Ruleset');

            const dataStart = hdrIdx + 2; // skip sub-header row
            for (let r = dataStart; r < ruleRows.length; r++) {
                const row = ruleRows[r];
                if (!isDataRow(row)) continue;
                const cells = row as unknown[];

                const ruleName = str(cells[iRule]);
                if (!ruleName) continue;

                // Extract ruleset name from this sheet if available
                if (iRS !== -1 && str(cells[iRS]) && rulesetName === 'Unknown') {
                    rulesetName = str(cells[iRS]);
                    rulesetSummary.ruleset = rulesetName;
                }

                rules.push({
                    rule: ruleName,
                    remaining: num(cells[iRem]),
                    suppressed: num(cells[iSup]),
                });
            }
        }
    }

    // --- File sheet ---
    const fileRows = sheetToRows(wb, 'File');
    const files: FileSummary[] = [];

    if (fileRows.length > 0) {
        // Find header row (contains "File Name" or "File")
        let hdrIdx = findHeaderRow(fileRows, 'File Name');
        if (hdrIdx === -1) hdrIdx = findHeaderRow(fileRows, 'File');
        if (hdrIdx !== -1) {
            const iFile = findCol(fileRows[hdrIdx], 'File Name', 'File');
            const iFilePath = findCol(fileRows[hdrIdx], 'File Path');
            const iRuleCount = findCol(fileRows[hdrIdx], 'Rule');
            const iRem = findColInRows(fileRows, hdrIdx, 'Remaining');
            const iSup = findColInRows(fileRows, hdrIdx, 'Suppressed');

            const dataStart = hdrIdx + 2;
            for (let r = dataStart; r < fileRows.length; r++) {
                const row = fileRows[r];
                if (!isDataRow(row)) continue;
                const cells = row as unknown[];

                let fileName = str(cells[iFile]);
                if (!fileName) continue;

                // Optionally combine file path + file name
                const filePath = iFilePath !== -1 ? str(cells[iFilePath]) : '';
                const displayName = filePath ? `${filePath}/${fileName}` : fileName;

                files.push({
                    file: displayName,
                    ruleCount: num(cells[iRuleCount]),
                    remaining: num(cells[iRem]),
                    suppressed: num(cells[iSup]),
                });
            }
        }
    }

    return {
        summary,
        rulesetSummary,
        rules,
        files,
        rulesetName,
    };
}

/* ============================
   Parse Reference (위배 유형 분류 현황)
   ============================ */

export async function parseReference(file: File): Promise<ParsedReference[]> {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const refs: ParsedReference[] = [];

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as Row[];
        if (rows.length < 2) continue;

        // Find header row: look for a row containing "규칙명" or "Rule"
        let hdrIdx = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
            const row = rows[i];
            if (!row) continue;
            for (const cell of row as unknown[]) {
                const val = str(cell).toUpperCase();
                if (val === '규칙명' || val === '규칙 명' || val === 'RULE' || val === 'RULENAME') {
                    hdrIdx = i;
                    break;
                }
            }
            if (hdrIdx !== -1) break;
        }

        if (hdrIdx === -1) continue; // not a relevant sheet

        const headerRow = rows[hdrIdx];
        const iRule = findCol(headerRow, '규칙명', '규칙 명', 'Rule', 'RuleName');
        if (iRule === -1) continue;

        // Find classification and justification columns
        // Real file has: 규칙명, 위배 내용, 유형, 분석 의견, Manual Code 여부, 비고
        const iClass = findCol(headerRow, '유형', '유형 분류', '유형분류', '분류', 'Classification');
        const iJust = findCol(headerRow, '분석 의견', '정당화 의견', '정당화의견', '의견', 'Justification');
        const iDesc = findCol(headerRow, '위배 내용', 'Description');

        for (let r = hdrIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row) continue;
            const cells = row as unknown[];
            const nonEmpty = cells.filter(c => str(c) !== '');
            if (nonEmpty.length === 0) continue;

            const ruleName = str(cells[iRule]);
            if (!ruleName) continue;

            // Build classification string
            let classification = '';
            if (iClass !== -1) classification = str(cells[iClass]);

            // Build justification: combine description + analysis opinion if both exist
            let justification = '';
            if (iJust !== -1) justification = str(cells[iJust]);
            // If there's a description column and no separate justification
            const description = iDesc !== -1 ? str(cells[iDesc]) : '';

            refs.push({
                ruleset: sheetName,
                ruleNameOriginal: ruleName,
                ruleName: normalizeRuleName(ruleName),
                classification: classification || '',
                justification: justification || description || '',
            });
        }
    }

    return refs;
}
