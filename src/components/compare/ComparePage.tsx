import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Session, RulesetReport, RuleSummary, CompareResult, RuleDelta, DrawerState, EnhancedRootCause } from '../../types';
import { getSessions, getRulesetReportsBySession } from '../../services/db';
import { normalizeRuleName } from '../../services/normalizer';
import { computeHighlights, computeFileDelta } from '../../services/highlights';
import { computeRulesetComparison } from '../../services/rulesetCompare';
import RuleDetailDrawer from '../common/RuleDetailDrawer';

/* ===========================
   Compare logic
   =========================== */

function computeCompare(
    currentReports: RulesetReport[],
    previousReports: RulesetReport[]
): CompareResult {
    const currentMap = new Map<string, { remaining: number; suppressed: number }>();
    const previousMap = new Map<string, { remaining: number; suppressed: number }>();

    for (const r of currentReports) {
        for (const rule of r.rules) {
            const key = normalizeRuleName(rule.rule);
            const existing = currentMap.get(key) || { remaining: 0, suppressed: 0 };
            currentMap.set(key, {
                remaining: existing.remaining + rule.remaining,
                suppressed: existing.suppressed + rule.suppressed,
            });
        }
    }

    for (const r of previousReports) {
        for (const rule of r.rules) {
            const key = normalizeRuleName(rule.rule);
            const existing = previousMap.get(key) || { remaining: 0, suppressed: 0 };
            previousMap.set(key, {
                remaining: existing.remaining + rule.remaining,
                suppressed: existing.suppressed + rule.suppressed,
            });
        }
    }

    const newRules: RuleSummary[] = [];
    const increasedRules: RuleDelta[] = [];
    const decreasedRules: RuleDelta[] = [];
    const unchangedRules: RuleDelta[] = [];
    const removedRules: RuleSummary[] = [];

    for (const [key, cur] of currentMap) {
        const prev = previousMap.get(key);
        if (!prev) {
            newRules.push({ rule: key, remaining: cur.remaining, suppressed: cur.suppressed });
        } else {
            const delta = cur.remaining - prev.remaining;
            const rd: RuleDelta = {
                rule: key,
                currentRemaining: cur.remaining,
                previousRemaining: prev.remaining,
                delta,
                currentSuppressed: cur.suppressed,
                previousSuppressed: prev.suppressed,
            };
            if (delta > 0) increasedRules.push(rd);
            else if (delta < 0) decreasedRules.push(rd);
            else unchangedRules.push(rd);
        }
    }

    for (const [key, prev] of previousMap) {
        if (!currentMap.has(key)) {
            removedRules.push({ rule: key, remaining: prev.remaining, suppressed: prev.suppressed });
        }
    }

    increasedRules.sort((a, b) => b.delta - a.delta);
    decreasedRules.sort((a, b) => a.delta - b.delta);

    return { newRules, removedRules, increasedRules, decreasedRules, unchangedRules };
}

/* ===========================
   Enhanced Root Cause Guess
   =========================== */

function guessRootCauses(
    result: CompareResult,
    currentReports: RulesetReport[],
    previousReports: RulesetReport[]
): EnhancedRootCause[] {
    const causes: EnhancedRootCause[] = [];

    // Pattern A: Multiple files increased → possible shared code modification
    if (result.increasedRules.length > 0) {
        const topIncrease = result.increasedRules[0];
        const filesWithRule = new Set<string>();
        for (const r of currentReports) {
            for (const f of r.files) {
                if (f.remaining > 0) filesWithRule.add(f.file);
            }
        }
        if (filesWithRule.size > 5 && result.increasedRules.length >= 3) {
            causes.push({
                type: 'multi-file',
                pattern: 'A',
                title: '다수 파일에서 동시 증가 — 공유 코드 수정 가능성',
                description: `${result.increasedRules.length}개 규칙이 ${filesWithRule.size}개 파일에서 동시에 증가. 공통 헤더/유틸리티 코드의 변경, 또는 코딩 패턴 일괄 변경이 원인일 수 있음. 최다 증가 규칙: "${topIncrease.rule}" (+${topIncrease.delta}).`,
                confidence: result.increasedRules.length >= 5 ? 'High' : 'Medium',
            });
        }
    }

    // Pattern B: Single hotspot file spike → possible feature addition or refactor
    const allCurrentFiles = currentReports.flatMap(r => r.files);
    const allPrevFiles = previousReports.flatMap(r => r.files);
    const prevFileMap = new Map(allPrevFiles.map(f => [f.file, f.remaining]));
    const deltaFiles = allCurrentFiles
        .map(f => ({ file: f.file, delta: f.remaining - (prevFileMap.get(f.file) || 0) }))
        .filter(f => f.delta > 5)
        .sort((a, b) => b.delta - a.delta);

    if (deltaFiles.length > 0 && deltaFiles.length <= 3) {
        const topFile = deltaFiles[0];
        causes.push({
            type: 'concentration',
            pattern: 'B',
            title: '특정 파일에 위배 집중 — 기능 추가/리팩토링 가능성',
            description: `${deltaFiles.length}개 파일에서 위배가 집중 증가. 특히 "${topFile.file}" (+${topFile.delta})에서 가장 큰 증가. 해당 파일의 최근 커밋 이력을 확인하여 새 기능 추가나 대규모 리팩토링이 있었는지 조사 필요.`,
            confidence: deltaFiles.length === 1 ? 'High' : 'Medium',
        });
    }

    // Pattern C: Suppressed spike → possible analysis criteria adjustment
    const totalCurrentSuppressed = currentReports.reduce((s, r) => s + r.rulesetSummary.suppressed, 0);
    const totalPrevSuppressed = previousReports.reduce((s, r) => s + r.rulesetSummary.suppressed, 0);
    const suppressDelta = totalCurrentSuppressed - totalPrevSuppressed;
    if (suppressDelta > 10) {
        causes.push({
            type: 'suppression',
            pattern: 'C',
            title: 'Suppressed 급증 — 분석 기준 조정 가능성',
            description: `Suppressed 건수가 ${suppressDelta}건 증가 (${totalPrevSuppressed} → ${totalCurrentSuppressed}). 실제 코드 수정 없이 규칙을 억제 처리했거나, 분석 도구의 기준이 변경되었을 수 있음. 억제 사유 검토 필요.`,
            confidence: suppressDelta > 30 ? 'High' : 'Medium',
        });
    }

    // Pattern D: New rules → tool update or new ruleset
    if (result.newRules.length > 0) {
        const totalNewRemaining = result.newRules.reduce((s, r) => s + r.remaining, 0);
        causes.push({
            type: 'new-rules',
            pattern: 'D',
            title: `${result.newRules.length}개 신규 규칙 탐지 — 도구 업데이트 가능성`,
            description: `이전 회차에 없던 규칙 ${result.newRules.length}개가 새로 등장 (총 Remaining ${totalNewRemaining}건). 분석 도구 버전 업데이트, 새 룰셋 적용, 또는 코드에 새로운 패턴이 도입된 경우일 수 있음. 신규 규칙: ${result.newRules.slice(0, 3).map(r => r.rule).join(', ')}${result.newRules.length > 3 ? ` 외 ${result.newRules.length - 3}건` : ''}.`,
            confidence: result.newRules.length >= 5 ? 'High' : 'Low',
        });
    }

    return causes;
}

/* ===========================
   Auto Summary
   =========================== */

function generateSummary(
    result: CompareResult,
    currentLabel: string,
    previousLabel: string,
    currentReports: RulesetReport[],
    previousReports: RulesetReport[]
): string {
    const totalCurRemaining = currentReports.reduce((s, r) => s + r.rulesetSummary.remaining, 0);
    const totalPrevRemaining = previousReports.reduce((s, r) => s + r.rulesetSummary.remaining, 0);
    const totalDelta = totalCurRemaining - totalPrevRemaining;
    const direction = totalDelta > 0 ? '증가' : totalDelta < 0 ? '감소' : '동일';

    const lines: string[] = [];
    lines.push(`[${currentLabel} vs ${previousLabel} 비교 분석 요약]`);
    lines.push('');
    lines.push(`■ 전체 Remaining: ${totalPrevRemaining} → ${totalCurRemaining} (${totalDelta > 0 ? '+' : ''}${totalDelta}, ${direction})`);
    lines.push('');

    if (result.newRules.length > 0) {
        lines.push(`■ 신규 규칙 ${result.newRules.length}건: ${result.newRules.map(r => r.rule).join(', ')}`);
    }

    if (result.increasedRules.length > 0) {
        lines.push(`■ 증가 규칙 ${result.increasedRules.length}건:`);
        result.increasedRules.slice(0, 5).forEach(r => {
            lines.push(`  - ${r.rule}: ${r.previousRemaining} → ${r.currentRemaining} (+${r.delta})`);
        });
    }

    if (result.decreasedRules.length > 0) {
        lines.push(`■ 감소 규칙 ${result.decreasedRules.length}건:`);
        result.decreasedRules.slice(0, 5).forEach(r => {
            lines.push(`  - ${r.rule}: ${r.previousRemaining} → ${r.currentRemaining} (${r.delta})`);
        });
    }

    if (result.removedRules.length > 0) {
        lines.push(`■ 해소된 규칙 ${result.removedRules.length}건: ${result.removedRules.map(r => r.rule).join(', ')}`);
    }

    return lines.join('\n');
}

/* ===========================
   Component
   =========================== */

type TabKey = 'summary' | 'highlights' | 'new' | 'increased' | 'decreased' | 'files' | 'rootcause' | 'rulesets';

const ComparePage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string>('');
    const [prevSessionId, setPrevSessionId] = useState<string>('');
    const [currentReports, setCurrentReports] = useState<RulesetReport[]>([]);
    const [prevReports, setPrevReports] = useState<RulesetReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<TabKey>('summary');
    const [drawer, setDrawer] = useState<DrawerState>({ isOpen: false, ruleName: null, sessionId: null, compareSessionId: null });
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        (async () => {
            const allSessions = await getSessions();
            allSessions.sort((a, b) => b.createdAt - a.createdAt);
            setSessions(allSessions);

            if (allSessions.length >= 2) {
                const paramSession = searchParams.get('session');
                const curId = paramSession || allSessions[0].id;
                const prevId = allSessions.find(s => s.id !== curId)?.id || allSessions[1].id;
                setCurrentSessionId(curId);
                setPrevSessionId(prevId);
            }
            setLoading(false);
        })();
    }, [searchParams]);

    useEffect(() => {
        if (!currentSessionId || !prevSessionId) return;
        (async () => {
            const [cur, prev] = await Promise.all([
                getRulesetReportsBySession(currentSessionId),
                getRulesetReportsBySession(prevSessionId),
            ]);
            setCurrentReports(cur);
            setPrevReports(prev);
        })();
    }, [currentSessionId, prevSessionId]);

    const compareResult = useMemo(() => {
        if (currentReports.length === 0 || prevReports.length === 0) return null;
        return computeCompare(currentReports, prevReports);
    }, [currentReports, prevReports]);

    const rootCauses = useMemo(() => {
        if (!compareResult) return [];
        return guessRootCauses(compareResult, currentReports, prevReports);
    }, [compareResult, currentReports, prevReports]);

    const highlights = useMemo(() => {
        if (!compareResult) return [];
        return computeHighlights(compareResult, currentReports, prevReports);
    }, [compareResult, currentReports, prevReports]);

    const fileDeltas = useMemo(() => {
        if (currentReports.length === 0 || prevReports.length === 0) return [];
        return computeFileDelta(currentReports, prevReports);
    }, [currentReports, prevReports]);

    const rulesetComparison = useMemo(() => {
        if (currentReports.length === 0 || prevReports.length === 0) return [];
        return computeRulesetComparison(currentReports, prevReports);
    }, [currentReports, prevReports]);

    const summaryText = useMemo(() => {
        if (!compareResult) return '';
        const curLabel = sessions.find(s => s.id === currentSessionId)?.analysisId || currentSessionId;
        const prevLabel = sessions.find(s => s.id === prevSessionId)?.analysisId || prevSessionId;
        return generateSummary(compareResult, curLabel, prevLabel, currentReports, prevReports);
    }, [compareResult, sessions, currentSessionId, prevSessionId, currentReports, prevReports]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(summaryText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openDrawer = (ruleName: string) => {
        setDrawer({
            isOpen: true,
            ruleName,
            sessionId: currentSessionId,
            compareSessionId: prevSessionId,
        });
    };

    if (loading) return <div className="empty-state"><div className="spinner" /></div>;
    if (sessions.length < 2) return (
        <div className="empty-state fade-in">
            <div className="empty-state-icon">🔀</div>
            <h3 className="empty-state-title">비교할 세션이 부족합니다</h3>
            <p className="empty-state-text">최소 2개 이상의 회차 세션이 필요합니다.</p>
        </div>
    );

    const curLabel = sessions.find(s => s.id === currentSessionId)?.analysisId || '';
    const prevLabel = sessions.find(s => s.id === prevSessionId)?.analysisId || '';

    const CONFIDENCE_COLORS: Record<string, string> = {
        High: 'var(--color-danger)',
        Medium: 'var(--color-warning)',
        Low: 'var(--text-muted)',
    };

    const HIGHLIGHT_ICONS: Record<string, string> = {
        'top-increased': '📈',
        'top-decreased': '📉',
        'file-spike': '📂',
        'suppressed-spike': '🔇',
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Compare</h1>
                <p className="page-subtitle">회차 간 규칙 변화 비교</p>
            </div>

            <div className="page-body">
                {/* Session Selectors */}
                <div className="compare-header">
                    <div className="input-group">
                        <label className="input-label">Current</label>
                        <select className="input" value={currentSessionId} onChange={e => setCurrentSessionId(e.target.value)}>
                            {sessions.map(s => <option key={s.id} value={s.id}>{s.analysisId}</option>)}
                        </select>
                    </div>
                    <span style={{ fontSize: 20, color: 'var(--text-muted)', marginTop: 22 }}>vs</span>
                    <div className="input-group">
                        <label className="input-label">Previous</label>
                        <select className="input" value={prevSessionId} onChange={e => setPrevSessionId(e.target.value)}>
                            {sessions.map(s => <option key={s.id} value={s.id}>{s.analysisId}</option>)}
                        </select>
                    </div>

                    {compareResult && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
                            <span className="badge badge-danger">New: {compareResult.newRules.length}</span>
                            <span className="badge badge-warning">↑ {compareResult.increasedRules.length}</span>
                            <span className="badge badge-success">↓ {compareResult.decreasedRules.length}</span>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="tab-bar">
                    {([
                        { key: 'summary', label: '📝 Summary' },
                        { key: 'highlights', label: `⚡ Highlights (${highlights.length})` },
                        { key: 'new', label: `🆕 New (${compareResult?.newRules.length ?? 0})` },
                        { key: 'increased', label: `📈 Increased (${compareResult?.increasedRules.length ?? 0})` },
                        { key: 'decreased', label: `📉 Decreased (${compareResult?.decreasedRules.length ?? 0})` },
                        { key: 'files', label: `📂 Files (${fileDeltas.length})` },
                        { key: 'rulesets', label: `📦 Rulesets (${rulesetComparison.length})` },
                        { key: 'rootcause', label: `🔍 Root Cause (${rootCauses.length})` },
                    ] as { key: TabKey; label: string }[]).map(t => (
                        <button
                            key={t.key}
                            className={`tab-item ${tab === t.key ? 'active' : ''}`}
                            onClick={() => setTab(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {compareResult && (
                    <div className="fade-in">
                        {/* Summary */}
                        {tab === 'summary' && (
                            <div className="summary-box">
                                <button className="btn btn-sm btn-secondary summary-box-copy" onClick={handleCopy}>
                                    {copied ? '✅ Copied!' : '📋 Copy'}
                                </button>
                                <pre className="summary-text">{summaryText}</pre>
                            </div>
                        )}

                        {/* Highlights */}
                        {tab === 'highlights' && (
                            <div>
                                {highlights.length === 0 ? (
                                    <div className="card">
                                        <div className="empty-state">
                                            <div className="empty-state-icon">✨</div>
                                            <p className="empty-state-text">특별한 하이라이트가 없습니다.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="highlight-grid">
                                        {highlights.map((h, i) => (
                                            <div key={i} className={`highlight-card highlight-card--${h.type}`}>
                                                <div className="highlight-card-icon">{HIGHLIGHT_ICONS[h.type] || '📌'}</div>
                                                <div className="highlight-card-name">{h.name}</div>
                                                <div className={`highlight-card-delta ${h.delta > 0 ? 'delta-positive' : h.delta < 0 ? 'delta-negative' : ''}`}>
                                                    {h.delta > 0 ? '+' : ''}{h.delta}
                                                </div>
                                                <div className="highlight-card-explanation">{h.explanation}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* New Rules */}
                        {tab === 'new' && (
                            <div className="card">
                                {compareResult.newRules.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">✅</div>
                                        <p className="empty-state-text">신규 규칙 없음</p>
                                    </div>
                                ) : (
                                    <div className="data-table-wrapper">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Rule</th>
                                                    <th className="num">Remaining ({curLabel})</th>
                                                    <th className="num">Suppressed ({curLabel})</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {compareResult.newRules.map(r => (
                                                    <tr key={r.rule}>
                                                        <td className="clickable" onClick={() => openDrawer(r.rule)}>{r.rule}</td>
                                                        <td className="num"><span className="badge badge-danger">{r.remaining}</span></td>
                                                        <td className="num">{r.suppressed}</td>
                                                        <td><span className="badge badge-warning">🆕 New</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Increased */}
                        {tab === 'increased' && (
                            <div className="card">
                                {compareResult.increasedRules.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">✅</div>
                                        <p className="empty-state-text">증가한 규칙 없음</p>
                                    </div>
                                ) : (
                                    <div className="data-table-wrapper">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Rule</th>
                                                    <th className="num">{prevLabel}</th>
                                                    <th className="num">{curLabel}</th>
                                                    <th className="num">Δ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {compareResult.increasedRules.map(r => (
                                                    <tr key={r.rule}>
                                                        <td className="clickable" onClick={() => openDrawer(r.rule)}>{r.rule}</td>
                                                        <td className="num">{r.previousRemaining}</td>
                                                        <td className="num">{r.currentRemaining}</td>
                                                        <td className="num delta-positive">+{r.delta}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Decreased */}
                        {tab === 'decreased' && (
                            <div className="card">
                                {compareResult.decreasedRules.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">✅</div>
                                        <p className="empty-state-text">감소한 규칙 없음</p>
                                    </div>
                                ) : (
                                    <div className="data-table-wrapper">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Rule</th>
                                                    <th className="num">{prevLabel}</th>
                                                    <th className="num">{curLabel}</th>
                                                    <th className="num">Δ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {compareResult.decreasedRules.map(r => (
                                                    <tr key={r.rule}>
                                                        <td className="clickable" onClick={() => openDrawer(r.rule)}>{r.rule}</td>
                                                        <td className="num">{r.previousRemaining}</td>
                                                        <td className="num">{r.currentRemaining}</td>
                                                        <td className="num delta-negative">{r.delta}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* File Comparison */}
                        {tab === 'files' && (
                            <div className="card">
                                {fileDeltas.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">📂</div>
                                        <p className="empty-state-text">파일 비교 데이터 없음</p>
                                    </div>
                                ) : (
                                    <div className="data-table-wrapper">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>File</th>
                                                    <th className="num">Prev Rem</th>
                                                    <th className="num">Cur Rem</th>
                                                    <th className="num">Δ Rem</th>
                                                    <th className="num">Δ Rules</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {fileDeltas.map((f, i) => (
                                                    <tr key={f.file}>
                                                        <td style={{ fontWeight: 700, color: 'var(--accent-primary-light)' }}>{i + 1}</td>
                                                        <td className="truncate" style={{ maxWidth: 280, fontWeight: 500, color: 'var(--text-primary)' }}>{f.file}</td>
                                                        <td className="num">{f.previousRemaining}</td>
                                                        <td className="num">{f.currentRemaining}</td>
                                                        <td className={`num ${f.remainingDelta > 0 ? 'delta-positive' : f.remainingDelta < 0 ? 'delta-negative' : ''}`}>
                                                            {f.remainingDelta > 0 ? '+' : ''}{f.remainingDelta}
                                                        </td>
                                                        <td className={`num ${f.ruleCountDelta > 0 ? 'delta-positive' : f.ruleCountDelta < 0 ? 'delta-negative' : ''}`}>
                                                            {f.ruleCountDelta > 0 ? '+' : ''}{f.ruleCountDelta}
                                                        </td>
                                                        <td>
                                                            {f.isNewInTop && <span className="badge badge-warning" style={{ fontSize: 10 }}>🆕 NEW</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Ruleset Comparison */}
                        {tab === 'rulesets' && (
                            <div>
                                {rulesetComparison.length === 0 ? (
                                    <div className="card">
                                        <div className="empty-state">
                                            <div className="empty-state-icon">📦</div>
                                            <p className="empty-state-text">룰셋 비교 데이터 없음</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="ruleset-compare-grid">
                                        {rulesetComparison.map(rc => (
                                            <div key={rc.ruleset} className="ruleset-compare-card">
                                                <div className="ruleset-compare-header">
                                                    <h4 className="ruleset-compare-name">📦 {rc.ruleset}</h4>
                                                </div>
                                                <div className="ruleset-compare-deltas">
                                                    <div className="ruleset-delta-item">
                                                        <span className="ruleset-delta-label">Remaining Δ</span>
                                                        <span className={`ruleset-delta-value ${rc.remainingDelta > 0 ? 'delta-positive' : rc.remainingDelta < 0 ? 'delta-negative' : ''}`}>
                                                            {rc.remainingDelta > 0 ? '+' : ''}{rc.remainingDelta}
                                                        </span>
                                                        <span className="ruleset-delta-range">{rc.previousRemaining} → {rc.currentRemaining}</span>
                                                    </div>
                                                    <div className="ruleset-delta-item">
                                                        <span className="ruleset-delta-label">Suppressed Δ</span>
                                                        <span className={`ruleset-delta-value ${rc.suppressedDelta > 0 ? 'delta-positive' : rc.suppressedDelta < 0 ? 'delta-negative' : ''}`}>
                                                            {rc.suppressedDelta > 0 ? '+' : ''}{rc.suppressedDelta}
                                                        </span>
                                                        <span className="ruleset-delta-range">{rc.previousSuppressed} → {rc.currentSuppressed}</span>
                                                    </div>
                                                </div>

                                                {rc.newRules.length > 0 && (
                                                    <div className="ruleset-compare-section">
                                                        <div className="ruleset-section-title">🆕 New Rules ({rc.newRules.length})</div>
                                                        {rc.newRules.slice(0, 3).map(r => (
                                                            <div key={r.rule} className="ruleset-rule-item clickable" onClick={() => openDrawer(r.rule)}>
                                                                <span>{r.rule}</span>
                                                                <span className="badge badge-danger">{r.remaining}</span>
                                                            </div>
                                                        ))}
                                                        {rc.newRules.length > 3 && <div className="ruleset-rule-more">+{rc.newRules.length - 3} more</div>}
                                                    </div>
                                                )}

                                                {rc.topIncreased.length > 0 && (
                                                    <div className="ruleset-compare-section">
                                                        <div className="ruleset-section-title">📈 Top Increased</div>
                                                        {rc.topIncreased.slice(0, 3).map(r => (
                                                            <div key={r.rule} className="ruleset-rule-item clickable" onClick={() => openDrawer(r.rule)}>
                                                                <span>{r.rule}</span>
                                                                <span className="delta-positive">+{r.delta}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {rc.topDecreased.length > 0 && (
                                                    <div className="ruleset-compare-section">
                                                        <div className="ruleset-section-title">📉 Top Decreased</div>
                                                        {rc.topDecreased.slice(0, 3).map(r => (
                                                            <div key={r.rule} className="ruleset-rule-item clickable" onClick={() => openDrawer(r.rule)}>
                                                                <span>{r.rule}</span>
                                                                <span className="delta-negative">{r.delta}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Root Cause */}
                        {tab === 'rootcause' && (
                            <div>
                                {rootCauses.length === 0 ? (
                                    <div className="card">
                                        <div className="empty-state">
                                            <div className="empty-state-icon">🔍</div>
                                            <p className="empty-state-text">특별한 패턴이 발견되지 않았습니다.</p>
                                        </div>
                                    </div>
                                ) : (
                                    rootCauses.map((cause, i) => (
                                        <div key={i} className="root-cause-card">
                                            <div className="root-cause-header">
                                                <div className="root-cause-title">
                                                    {cause.type === 'multi-file' && '📂'}
                                                    {cause.type === 'concentration' && '🎯'}
                                                    {cause.type === 'suppression' && '🔇'}
                                                    {cause.type === 'new-rules' && '🆕'}
                                                    {' '}Pattern {cause.pattern}: {cause.title}
                                                </div>
                                                <span
                                                    className="confidence-badge"
                                                    style={{ color: CONFIDENCE_COLORS[cause.confidence], borderColor: CONFIDENCE_COLORS[cause.confidence] }}
                                                >
                                                    {cause.confidence}
                                                </span>
                                            </div>
                                            <div className="root-cause-desc">{cause.description}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <RuleDetailDrawer
                drawer={drawer}
                onClose={() => setDrawer(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};

export default ComparePage;
