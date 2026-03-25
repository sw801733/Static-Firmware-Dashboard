import type { Session, RulesetReport, Reference } from '../types';

/* ============================
   Fixture: 2 sessions (#1, #2) × 4 rulesets
   ============================ */

export const fixtureSessions: Session[] = [
    {
        id: 'session-1',
        analysisId: '#1',
        createdAt: Date.now() - 86400000 * 7,
        rulesetNames: ['MISRA-C:2012', 'CERT-C', 'CWE', 'CUSTOM-FW'],
    },
    {
        id: 'session-2',
        analysisId: '#2',
        createdAt: Date.now(),
        rulesetNames: ['MISRA-C:2012', 'CERT-C', 'CWE', 'CUSTOM-FW'],
    },
];

function makeRulesetReport(
    sessionId: string,
    ruleset: string,
    remainingBase: number,
    suppressedBase: number,
    seed: number
): RulesetReport {
    const rules = [
        { rule: 'Rule 8.4', remaining: Math.floor(remainingBase * 0.25 + seed), suppressed: Math.floor(suppressedBase * 0.1) },
        { rule: 'Rule 10.3', remaining: Math.floor(remainingBase * 0.15 + seed * 2), suppressed: Math.floor(suppressedBase * 0.08) },
        { rule: 'Rule 11.8', remaining: Math.floor(remainingBase * 0.12), suppressed: Math.floor(suppressedBase * 0.15 + seed) },
        { rule: 'Rule 14.3', remaining: Math.floor(remainingBase * 0.1 + seed * 0.5), suppressed: Math.floor(suppressedBase * 0.05) },
        { rule: 'Rule 15.7', remaining: Math.floor(remainingBase * 0.08), suppressed: Math.floor(suppressedBase * 0.12) },
        { rule: 'Rule 17.7', remaining: Math.floor(remainingBase * 0.06 + seed * 1.5), suppressed: Math.floor(suppressedBase * 0.2) },
        { rule: 'Rule 20.7', remaining: Math.floor(remainingBase * 0.05), suppressed: Math.floor(suppressedBase * 0.1 + seed) },
        { rule: 'Rule 21.2', remaining: Math.floor(remainingBase * 0.04), suppressed: Math.floor(suppressedBase * 0.05) },
    ];

    const files = [
        { file: 'src/hal/gpio_driver.c', ruleCount: 5, remaining: Math.floor(remainingBase * 0.18 + seed), suppressed: Math.floor(suppressedBase * 0.05) },
        { file: 'src/hal/spi_driver.c', ruleCount: 4, remaining: Math.floor(remainingBase * 0.12 + seed * 0.5), suppressed: Math.floor(suppressedBase * 0.08) },
        { file: 'src/core/scheduler.c', ruleCount: 6, remaining: Math.floor(remainingBase * 0.15), suppressed: Math.floor(suppressedBase * 0.1) },
        { file: 'src/core/memory_pool.c', ruleCount: 3, remaining: Math.floor(remainingBase * 0.08 + seed), suppressed: Math.floor(suppressedBase * 0.03) },
        { file: 'src/comm/uart_handler.c', ruleCount: 4, remaining: Math.floor(remainingBase * 0.1), suppressed: Math.floor(suppressedBase * 0.06) },
        { file: 'src/comm/can_protocol.c', ruleCount: 5, remaining: Math.floor(remainingBase * 0.09 + seed * 0.3), suppressed: Math.floor(suppressedBase * 0.04) },
        { file: 'src/app/main_loop.c', ruleCount: 2, remaining: Math.floor(remainingBase * 0.05), suppressed: Math.floor(suppressedBase * 0.02) },
        { file: 'src/app/config_parser.c', ruleCount: 3, remaining: Math.floor(remainingBase * 0.06 + seed), suppressed: Math.floor(suppressedBase * 0.07) },
    ];

    const totalRemaining = rules.reduce((s, r) => s + r.remaining, 0);
    const totalSuppressed = rules.reduce((s, r) => s + r.suppressed, 0);

    return {
        sessionId,
        ruleset,
        summary: {
            analysis: sessionId === 'session-1' ? '#1' : '#2',
            totalFiles: 120 + seed * 5,
            analyzedFiles: 115 + seed * 3,
            totalFunctions: 890 + seed * 20,
            lineOfCode: 45000 + seed * 2000,
        },
        rulesetSummary: {
            ruleset,
            remaining: totalRemaining,
            suppressed: totalSuppressed,
        },
        rules,
        files,
    };
}

export const fixtureReports: RulesetReport[] = [
    // Session 1
    makeRulesetReport('session-1', 'MISRA-C:2012', 120, 50, 0),
    makeRulesetReport('session-1', 'CERT-C', 80, 30, 2),
    makeRulesetReport('session-1', 'CWE', 60, 20, 1),
    makeRulesetReport('session-1', 'CUSTOM-FW', 40, 15, 3),
    // Session 2 has slightly different numbers
    makeRulesetReport('session-2', 'MISRA-C:2012', 110, 55, 5),
    makeRulesetReport('session-2', 'CERT-C', 85, 35, 0),
    makeRulesetReport('session-2', 'CWE', 55, 25, 3),
    makeRulesetReport('session-2', 'CUSTOM-FW', 45, 18, 1),
];

// Add some "new" rules to session 2 that don't exist in session 1
fixtureReports[4].rules.push({ rule: 'Rule 22.1', remaining: 8, suppressed: 2 });
fixtureReports[5].rules.push({ rule: 'Rule 23.5', remaining: 5, suppressed: 1 });

export const fixtureReferences: Reference[] = [
    { ruleName: 'RULE 8.4', ruleNameOriginal: 'Rule 8.4', ruleset: 'MISRA-C:2012', classification: '코드 품질', justification: '함수 프로토타입이 헤더에 선언되지 않은 경우. 헤더 파일에 extern 선언 추가 필요.' },
    { ruleName: 'RULE 10.3', ruleNameOriginal: 'Rule 10.3', ruleset: 'MISRA-C:2012', classification: '타입 안전성', justification: '암시적 형변환이 발생하는 경우. 명시적 캐스팅으로 수정.' },
    { ruleName: 'RULE 11.8', ruleNameOriginal: 'Rule 11.8', ruleset: 'MISRA-C:2012', classification: 'const 정합성', justification: 'const 한정자가 제거되는 캐스팅. const_cast 사용 금지.' },
    { ruleName: 'RULE 14.3', ruleNameOriginal: 'Rule 14.3', ruleset: 'MISRA-C:2012', classification: '데드 코드', justification: '항상 true/false인 조건식. 디버그 매크로이므로 Suppressed 처리.' },
    { ruleName: 'RULE 15.7', ruleNameOriginal: 'Rule 15.7', ruleset: 'MISRA-C:2012', classification: '제어 흐름', justification: 'if-else if 체인에 final else 누락. else 블록 추가 필요.' },
    { ruleName: 'RULE 17.7', ruleNameOriginal: 'Rule 17.7', ruleset: 'MISRA-C:2012', classification: '리턴값 무시', justification: '함수 반환값 미사용. (void) 캐스팅 또는 에러 처리 추가.' },
    { ruleName: 'RULE 20.7', ruleNameOriginal: 'Rule 20.7', ruleset: 'MISRA-C:2012', classification: '매크로 안전성', justification: '매크로 파라미터 괄호 누락. 매크로 정의 수정.' },
    // no reference for Rule 21.2, Rule 22.1, Rule 23.5 → "작성 필요" badge
];
