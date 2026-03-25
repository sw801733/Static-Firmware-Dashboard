import React, { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import type { Session, RulesetReport } from '../../types';
import { getSessions, getRulesetReportsBySession } from '../../services/db';
import { getDeduplicatedSessionValues } from '../../services/consistencyCheck';

/* ===========================
   Types
   =========================== */

interface TrendDataPoint {
    label: string;
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
    // Ruleset-level data (dynamic keys like "MISRA_remaining")
    [key: string]: string | number | boolean;
}

type TrendView = 'project' | 'ruleset';

function analysisOrder(id: string): number {
    const match = id.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

const PROJECT_CHART_LINES = [
    { key: 'remaining', name: 'Remaining', color: '#ff6b6b' },
    { key: 'suppressed', name: 'Suppressed', color: '#fdcb6e' },
    { key: 'loc', name: 'Lines of Code', color: '#74b9ff' },
    { key: 'functions', name: 'Functions', color: '#55efc4' },
];

const RULESET_COLORS = ['#6c5ce7', '#00cec9', '#fd79a8', '#fdcb6e', '#74b9ff', '#55efc4', '#e17055', '#a29bfe', '#ff6b6b', '#ffa502'];

/* ===========================
   Inconsistency tooltip
   =========================== */
const InconsistencyBadge: React.FC<{ tooltip: string }> = ({ tooltip }) => (
    <span className="inconsistency-badge" title={tooltip}>⚠️</span>
);

/* ===========================
   Component
   =========================== */

const TrendsPage: React.FC = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [reportMap, setReportMap] = useState<Map<string, RulesetReport[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [activeLines, setActiveLines] = useState<Set<string>>(new Set(['remaining', 'suppressed']));
    const [viewMode, setViewMode] = useState<TrendView>('project');

    useEffect(() => {
        (async () => {
            const allSessions = await getSessions();
            allSessions.sort((a, b) => analysisOrder(a.analysisId) - analysisOrder(b.analysisId));
            setSessions(allSessions);

            const map = new Map<string, RulesetReport[]>();
            for (const s of allSessions) {
                const reports = await getRulesetReportsBySession(s.id);
                map.set(s.id, reports);
            }
            setReportMap(map);
            setLoading(false);
        })();
    }, []);

    // Collect all unique ruleset names
    const allRulesetNames = useMemo(() => {
        const names = new Set<string>();
        for (const reports of reportMap.values()) {
            reports.forEach(r => names.add(r.ruleset));
        }
        return [...names].sort();
    }, [reportMap]);

    const trendData: TrendDataPoint[] = useMemo(() => {
        return sessions.map(s => {
            const reports = reportMap.get(s.id) || [];
            const dedup = getDeduplicatedSessionValues(reports);

            const point: TrendDataPoint = {
                label: s.analysisId,
                remaining: dedup.remaining,
                suppressed: dedup.suppressed,
                loc: dedup.loc,
                functions: dedup.functions,
                totalFiles: dedup.totalFiles,
                analyzedFiles: dedup.analyzedFiles,
                locConsistent: dedup.locConsistent,
                functionsConsistent: dedup.functionsConsistent,
                totalFilesConsistent: dedup.totalFilesConsistent,
                analyzedFilesConsistent: dedup.analyzedFilesConsistent,
            };

            // Add per-ruleset remaining/suppressed values
            for (const rsName of allRulesetNames) {
                const rsReport = reports.find(r => r.ruleset === rsName);
                point[`${rsName}_remaining`] = rsReport?.rulesetSummary.remaining ?? 0;
                point[`${rsName}_suppressed`] = rsReport?.rulesetSummary.suppressed ?? 0;
            }

            return point;
        });
    }, [sessions, reportMap, allRulesetNames]);

    const toggleLine = (key: string) => {
        setActiveLines(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // When switching view, reset active lines
    const switchView = (view: TrendView) => {
        setViewMode(view);
        if (view === 'project') {
            setActiveLines(new Set(['remaining', 'suppressed']));
        } else {
            setActiveLines(new Set(allRulesetNames.map(n => `${n}_remaining`)));
        }
    };

    if (loading) return <div className="empty-state"><div className="spinner" /></div>;
    if (sessions.length === 0) return (
        <div className="empty-state fade-in">
            <div className="empty-state-icon">📈</div>
            <h3 className="empty-state-title">데이터가 없습니다</h3>
            <p className="empty-state-text">세션을 업로드하면 트렌드를 확인할 수 있습니다.</p>
        </div>
    );

    const latest = trendData[trendData.length - 1];
    const prev = trendData.length >= 2 ? trendData[trendData.length - 2] : null;

    const INCONSISTENCY_TOOLTIP = '룰셋 간 값이 불일치합니다. 분석 설정 오류일 수 있습니다.';

    // Build chart lines based on view mode
    const chartLines = viewMode === 'project'
        ? PROJECT_CHART_LINES.filter(l => activeLines.has(l.key))
        : allRulesetNames.flatMap((name, i) => {
            const lines = [];
            const remKey = `${name}_remaining`;
            const supKey = `${name}_suppressed`;
            if (activeLines.has(remKey)) {
                lines.push({ key: remKey, name: `${name} Remaining`, color: RULESET_COLORS[i % RULESET_COLORS.length] });
            }
            if (activeLines.has(supKey)) {
                lines.push({ key: supKey, name: `${name} Suppressed`, color: RULESET_COLORS[(i + 5) % RULESET_COLORS.length] });
            }
            return lines;
        });

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">Trends</h1>
                        <p className="page-subtitle">회차별 추이 분석 ({sessions.length}개 세션)</p>
                    </div>
                    <div className="view-toggle">
                        <button className={`view-toggle-btn ${viewMode === 'project' ? 'active' : ''}`} onClick={() => switchView('project')}>
                            📊 Project
                        </button>
                        <button className={`view-toggle-btn ${viewMode === 'ruleset' ? 'active' : ''}`} onClick={() => switchView('ruleset')}>
                            📦 Ruleset
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-body">
                {/* KPI Summary Cards */}
                {latest && (
                    <div className="kpi-grid stagger" style={{ marginBottom: 24 }}>
                        <div className="kpi-card">
                            <div className="kpi-label">Remaining</div>
                            <div className="kpi-value">{latest.remaining.toLocaleString()}</div>
                            {prev && (
                                <div className={`kpi-delta ${latest.remaining - prev.remaining > 0 ? 'delta-positive' : 'delta-negative'}`}>
                                    {latest.remaining - prev.remaining > 0 ? '+' : ''}{latest.remaining - prev.remaining}
                                </div>
                            )}
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-label">Suppressed</div>
                            <div className="kpi-value">{latest.suppressed.toLocaleString()}</div>
                            {prev && (
                                <div className={`kpi-delta ${latest.suppressed - prev.suppressed > 0 ? 'delta-positive' : 'delta-negative'}`}>
                                    {latest.suppressed - prev.suppressed > 0 ? '+' : ''}{latest.suppressed - prev.suppressed}
                                </div>
                            )}
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-label">
                                Lines of Code
                                {!latest.locConsistent && <InconsistencyBadge tooltip={INCONSISTENCY_TOOLTIP} />}
                            </div>
                            <div className="kpi-value">
                                {latest.locConsistent ? latest.loc.toLocaleString() : (
                                    <span className="inconsistent-value">{latest.loc.toLocaleString()} <InconsistencyBadge tooltip={INCONSISTENCY_TOOLTIP} /></span>
                                )}
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-label">
                                Functions
                                {!latest.functionsConsistent && <InconsistencyBadge tooltip={INCONSISTENCY_TOOLTIP} />}
                            </div>
                            <div className="kpi-value">
                                {latest.functionsConsistent ? latest.functions.toLocaleString() : (
                                    <span className="inconsistent-value">{latest.functions.toLocaleString()} <InconsistencyBadge tooltip={INCONSISTENCY_TOOLTIP} /></span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Line toggle buttons */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {viewMode === 'project' ? (
                        PROJECT_CHART_LINES.map(line => (
                            <button
                                key={line.key}
                                className={`btn btn-sm ${activeLines.has(line.key) ? '' : 'btn-ghost'}`}
                                style={{
                                    borderColor: line.color,
                                    color: activeLines.has(line.key) ? '#fff' : line.color,
                                    background: activeLines.has(line.key) ? line.color : 'transparent',
                                }}
                                onClick={() => toggleLine(line.key)}
                            >
                                {line.name}
                            </button>
                        ))
                    ) : (
                        allRulesetNames.flatMap((name, i) => [
                            <button
                                key={`${name}_remaining`}
                                className={`btn btn-sm ${activeLines.has(`${name}_remaining`) ? '' : 'btn-ghost'}`}
                                style={{
                                    borderColor: RULESET_COLORS[i % RULESET_COLORS.length],
                                    color: activeLines.has(`${name}_remaining`) ? '#fff' : RULESET_COLORS[i % RULESET_COLORS.length],
                                    background: activeLines.has(`${name}_remaining`) ? RULESET_COLORS[i % RULESET_COLORS.length] : 'transparent',
                                }}
                                onClick={() => toggleLine(`${name}_remaining`)}
                            >
                                {name} Rem
                            </button>,
                            <button
                                key={`${name}_suppressed`}
                                className={`btn btn-sm ${activeLines.has(`${name}_suppressed`) ? '' : 'btn-ghost'}`}
                                style={{
                                    borderColor: RULESET_COLORS[(i + 5) % RULESET_COLORS.length],
                                    color: activeLines.has(`${name}_suppressed`) ? '#fff' : RULESET_COLORS[(i + 5) % RULESET_COLORS.length],
                                    background: activeLines.has(`${name}_suppressed`) ? RULESET_COLORS[(i + 5) % RULESET_COLORS.length] : 'transparent',
                                }}
                                onClick={() => toggleLine(`${name}_suppressed`)}
                            >
                                {name} Sup
                            </button>,
                        ])
                    )}
                </div>

                {/* Main trend chart */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            📈 {viewMode === 'project' ? 'Session Progression' : 'Ruleset Progression'}
                        </h3>
                    </div>
                    <div className="chart-container" style={{ height: 400 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d45" />
                                <XAxis dataKey="label" stroke="#6b6f85" fontSize={12} />
                                <YAxis stroke="#6b6f85" fontSize={11} />
                                <Tooltip
                                    contentStyle={{ background: '#1e2030', border: '1px solid #2a2d45', borderRadius: 8, fontSize: 12 }}
                                    labelStyle={{ color: '#e8eaf0', fontWeight: 700 }}
                                />
                                <Legend />
                                {chartLines.map(line => (
                                    <Line
                                        key={line.key}
                                        type="monotone"
                                        dataKey={line.key}
                                        name={line.name}
                                        stroke={line.color}
                                        strokeWidth={2}
                                        dot={{ r: 5, fill: line.color }}
                                        activeDot={{ r: 7 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Data table */}
                <div className="card mt-24">
                    <div className="card-header">
                        <h3 className="card-title">📊 Session Data</h3>
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Session</th>
                                    <th className="num">Remaining</th>
                                    <th className="num">Suppressed</th>
                                    <th className="num">LOC</th>
                                    <th className="num">Functions</th>
                                    <th className="num">Total Files</th>
                                    <th className="num">Analyzed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trendData.map((d, i) => {
                                    const prevD = i > 0 ? trendData[i - 1] : null;
                                    const remDelta = prevD ? d.remaining - prevD.remaining : 0;
                                    return (
                                        <tr key={d.label}>
                                            <td style={{ fontWeight: 700, color: 'var(--accent-primary-light)' }}>{d.label}</td>
                                            <td className="num">
                                                <span className="badge badge-danger">{d.remaining}</span>
                                                {prevD && (
                                                    <span className={`ml-8 ${remDelta > 0 ? 'delta-positive' : remDelta < 0 ? 'delta-negative' : ''}`} style={{ fontSize: 11 }}>
                                                        {remDelta > 0 ? '+' : ''}{remDelta}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="num"><span className="badge badge-warning">{d.suppressed}</span></td>
                                            <td className="num">
                                                {d.loc.toLocaleString()}
                                                {!d.locConsistent && <InconsistencyBadge tooltip={INCONSISTENCY_TOOLTIP} />}
                                            </td>
                                            <td className="num">
                                                {d.functions.toLocaleString()}
                                                {!d.functionsConsistent && <InconsistencyBadge tooltip={INCONSISTENCY_TOOLTIP} />}
                                            </td>
                                            <td className="num">
                                                {d.totalFiles.toLocaleString()}
                                                {!d.totalFilesConsistent && <InconsistencyBadge tooltip={INCONSISTENCY_TOOLTIP} />}
                                            </td>
                                            <td className="num">
                                                {d.analyzedFiles.toLocaleString()}
                                                {!d.analyzedFilesConsistent && <InconsistencyBadge tooltip={INCONSISTENCY_TOOLTIP} />}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrendsPage;
