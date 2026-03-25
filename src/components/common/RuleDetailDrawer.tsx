import React, { useEffect, useState } from 'react';
import type { DrawerState, RuleSummary, Reference } from '../../types';
import { getRulesetReportsBySession, getReferences } from '../../services/db';
import { normalizeRuleName } from '../../services/normalizer';

interface Props {
    drawer: DrawerState;
    onClose: () => void;
}

const RuleDetailDrawer: React.FC<Props> = ({ drawer, onClose }) => {
    const [currentRule, setCurrentRule] = useState<RuleSummary | null>(null);
    const [compareRule, setCompareRule] = useState<RuleSummary | null>(null);
    const [references, setReferences] = useState<Reference[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!drawer.isOpen || !drawer.ruleName) return;

        (async () => {
            setLoading(true);
            const normalizedName = normalizeRuleName(drawer.ruleName!);

            // Current session
            if (drawer.sessionId) {
                const reports = await getRulesetReportsBySession(drawer.sessionId);
                for (const r of reports) {
                    const found = r.rules.find(rule => normalizeRuleName(rule.rule) === normalizedName);
                    if (found) { setCurrentRule(found); break; }
                }
            }

            // Compare session
            if (drawer.compareSessionId) {
                const reports = await getRulesetReportsBySession(drawer.compareSessionId);
                let found: RuleSummary | null = null;
                for (const r of reports) {
                    const f = r.rules.find(rule => normalizeRuleName(rule.rule) === normalizedName);
                    if (f) { found = f; break; }
                }
                setCompareRule(found);
            } else {
                setCompareRule(null);
            }

            // References
            const allRefs = await getReferences();
            const matched = allRefs.filter(ref => ref.ruleName === normalizedName);
            setReferences(matched);

            setLoading(false);
        })();
    }, [drawer.isOpen, drawer.ruleName, drawer.sessionId, drawer.compareSessionId]);

    return (
        <>
            <div className={`drawer-overlay ${drawer.isOpen ? 'open' : ''}`} onClick={onClose} />
            <div className={`drawer ${drawer.isOpen ? 'open' : ''}`}>
                <div className="drawer-header">
                    <h2 className="drawer-title">Rule Detail</h2>
                    <button className="drawer-close" onClick={onClose}>✕</button>
                </div>

                <div className="drawer-body">
                    {loading ? (
                        <div className="flex-center" style={{ padding: 40 }}>
                            <div className="spinner" />
                        </div>
                    ) : (
                        <>
                            {/* Rule Name */}
                            <div className="drawer-section">
                                <div className="drawer-section-title">규칙명</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-primary-light)' }}>
                                    {drawer.ruleName}
                                </div>
                            </div>

                            {/* Current Session Data */}
                            {currentRule && (
                                <div className="drawer-section">
                                    <div className="drawer-section-title">현재 회차</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div className="kpi-card" style={{ padding: 14 }}>
                                            <div className="kpi-label">Remaining</div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-danger)' }}>
                                                {currentRule.remaining}
                                            </div>
                                        </div>
                                        <div className="kpi-card" style={{ padding: 14 }}>
                                            <div className="kpi-label">Suppressed</div>
                                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-warning)' }}>
                                                {currentRule.suppressed}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Compare Session Data */}
                            {drawer.compareSessionId && (
                                <div className="drawer-section">
                                    <div className="drawer-section-title">비교 회차</div>
                                    {compareRule ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div className="kpi-card" style={{ padding: 14, borderColor: 'var(--border-color-light)' }}>
                                                <div className="kpi-label">Remaining</div>
                                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                                    {compareRule.remaining}
                                                </div>
                                            </div>
                                            <div className="kpi-card" style={{ padding: 14, borderColor: 'var(--border-color-light)' }}>
                                                <div className="kpi-label">Suppressed</div>
                                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                                    {compareRule.suppressed}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="badge badge-warning">비교 회차에 해당 규칙 없음 (New Rule)</div>
                                    )}

                                    {/* Delta */}
                                    {currentRule && compareRule && (
                                        <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                                            <div>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Δ Remaining: </span>
                                                <span className={
                                                    currentRule.remaining - compareRule.remaining > 0 ? 'delta-positive' :
                                                        currentRule.remaining - compareRule.remaining < 0 ? 'delta-negative' : 'delta-zero'
                                                }>
                                                    {currentRule.remaining - compareRule.remaining > 0 ? '+' : ''}
                                                    {currentRule.remaining - compareRule.remaining}
                                                </span>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Δ Suppressed: </span>
                                                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                    {currentRule.suppressed - compareRule.suppressed > 0 ? '+' : ''}
                                                    {currentRule.suppressed - compareRule.suppressed}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* References */}
                            <div className="drawer-section">
                                <div className="drawer-section-title">레퍼런스 (유형 분류 / 정당화 의견)</div>
                                {references.length === 0 ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="badge badge-warning">⚠️ 작성 필요</span>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            위배 유형 분류 현황 파일에 해당 규칙이 없습니다.
                                        </span>
                                    </div>
                                ) : (
                                    references.map((ref, i) => (
                                        <div key={i} style={{
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 16,
                                            marginBottom: 8,
                                            border: '1px solid var(--border-color)',
                                        }}>
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                                <span className="badge badge-info">{ref.ruleset}</span>
                                                <span className="badge badge-success">{ref.classification || '미분류'}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>원래 규칙명</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{ref.ruleNameOriginal}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>정당화 의견</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                                {ref.justification || '(없음)'}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default RuleDetailDrawer;
