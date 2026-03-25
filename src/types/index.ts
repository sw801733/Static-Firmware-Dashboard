/* ============================
   Core domain types
   ============================ */

export interface Session {
  id: string;
  analysisId: string; // e.g. "#1", "#5"
  createdAt: number; // timestamp
  rulesetNames: string[];
}

export interface SummaryData {
  analysis: string;
  totalFiles: number;
  analyzedFiles: number;
  totalFunctions: number;
  lineOfCode: number;
}

export interface RulesetSummary {
  ruleset: string;
  remaining: number;
  suppressed: number;
}

export interface RuleSummary {
  rule: string;
  remaining: number;
  suppressed: number;
}

export interface FileSummary {
  file: string;
  ruleCount: number;
  remaining: number;
  suppressed: number;
}

export interface RulesetReport {
  id?: number; // auto-increment key in IDB
  sessionId: string;
  ruleset: string;
  summary: SummaryData;
  rulesetSummary: RulesetSummary;
  rules: RuleSummary[];
  files: FileSummary[];
}

export interface Reference {
  id?: number;
  ruleName: string; // normalized
  ruleNameOriginal: string;
  ruleset: string;
  classification: string; // 유형 분류
  justification: string; // 정당화 의견
}

/* ============================
   Parsed intermediate types (from Excel)
   ============================ */

export interface ParsedProjectReport {
  summary: SummaryData;
  rulesetSummary: RulesetSummary;
  rules: RuleSummary[];
  files: FileSummary[];
  rulesetName: string; // extracted from Ruleset sheet or filename
}

export interface ParsedReference {
  ruleset: string;
  ruleName: string;
  ruleNameOriginal: string;
  classification: string;
  justification: string;
}

/* ============================
   Compare types
   ============================ */

export interface RuleDelta {
  rule: string;
  currentRemaining: number;
  previousRemaining: number;
  delta: number;
  currentSuppressed: number;
  previousSuppressed: number;
}

export interface CompareResult {
  newRules: RuleSummary[];
  removedRules: RuleSummary[];
  increasedRules: RuleDelta[];
  decreasedRules: RuleDelta[];
  unchangedRules: RuleDelta[];
}

/* ============================
   Work Board types
   ============================ */

export type TaskStatus = 'TODO' | 'DOING' | 'DONE' | 'HOLD';
export type TaskType = 'REF_NEEDED' | 'INCREASE_INVESTIGATION' | 'PRIORITY_INSPECTION';

export interface WorkTask {
  id?: number;
  rule: string;
  ruleset: string;
  sessionId: string;
  taskType: TaskType;
  priorityScore: number;
  status: TaskStatus;
  createdAt: number;
}

/* ============================
   Compare enhancement types
   ============================ */

export interface Highlight {
  type: 'top-increased' | 'top-decreased' | 'file-spike' | 'suppressed-spike';
  name: string;
  delta: number;
  explanation: string;
}

export interface FileDelta {
  file: string;
  currentRemaining: number;
  previousRemaining: number;
  remainingDelta: number;
  currentRuleCount: number;
  previousRuleCount: number;
  ruleCountDelta: number;
  isNewInTop: boolean;
}

export interface EnhancedRootCause {
  type: string;
  pattern: 'A' | 'B' | 'C' | 'D';
  title: string;
  description: string;
  confidence: 'High' | 'Medium' | 'Low';
}

/* ============================
   Ruleset-level comparison types
   ============================ */

export interface RulesetCompareResult {
  ruleset: string;
  currentRemaining: number;
  previousRemaining: number;
  remainingDelta: number;
  currentSuppressed: number;
  previousSuppressed: number;
  suppressedDelta: number;
  newRules: RuleSummary[];
  topIncreased: RuleDelta[];
  topDecreased: RuleDelta[];
}

export interface ConsistencyCheck {
  field: 'loc' | 'totalFiles' | 'analyzedFiles' | 'totalFunctions';
  label: string;
  isConsistent: boolean;
  values: number[];
  displayValue: number;
}

/* ============================
   UI state types
   ============================ */

export interface DrawerState {
  isOpen: boolean;
  ruleName: string | null;
  sessionId: string | null;
  compareSessionId: string | null;
}
