import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { RulesetReport, RuleSummary, FileSummary, DrawerState } from '../../types';
import { getRulesetReportsBySession, getSessions } from '../../services/db';
import RuleDetailDrawer from '../common/RuleDetailDrawer';

const CHART_COLORS = ['#6c5ce7', '#00cec9', '#fd79a8', '#fdcb6e', '#74b9ff', '#55efc4', '#e17055', '#a29bfe'];

const OverviewPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [reports, setReports] = useState<RulesetReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [sessionLabel, setSessionLabel] = useState('');
    const [drawer, setDrawer] = useState<DrawerState>({ isOpen: false, ruleName: null, sessionId: null, compareSessionId: null });

    const sessionId = searchParams.get('session');

    useEffect(() => {
        (async () => {
            if (!sessionId) {
                // pick latest session
                const sessions = await getSessions();
                if (sessions.length === 0) { setLoading(false); return; }
                sessions.sort((a, b) => b.createdAt - a.createdAt);
                const latest = sessions[0];
                const r = await getRulesetReportsBySession(latest.id);
                setReports(r);
                setSessionLabel(latest.analysisId);
            } else {
                const r = await getRulesetReportsBySession(sessionId);
                setReports(r);
                const sessions = await getSessions();
                const s = sessions.find(s => s.id === sessionId);
                setSessionLabel(s?.analysisId || sessionId);
            }
            setLoading(false);
        })();
    }, [sessionId]);

    if (loading) return <div className="empty-state"><div className="spinner" /></div>;
    if (reports.length === 0) return (
        <div className="empty-state fade-in">
            <div className="empty-state-icon">📊</div>
            <h3 className="empty-state-title">데이터가 없습니다</h3>
            <p className="empty-state-text">세션을 선택하거나 새 세션을 업로드하세요.</p>
        </div>
    );

    // Aggregate KPIs
    const totalFiles = reports.reduce((s, r) => s + r.summary.totalFiles, 0);
    const analyzedFiles = reports.reduce((s, r) => s + r.summary.analyzedFiles, 0);
    const totalFunctions = reports.reduce((s, r) => s + r.summary.totalFunctions, 0);
    const loc = reports.reduce((s, r) => s + r.summary.lineOfCode, 0);

    // Ruleset table
    const rulesetData = reports.map(r => r.rulesetSummary);

    // Top 10 Rules (merge across rulesets)
    const allRules: (RuleSummary & { ruleset: string })[] = [];
    reports.forEach(r => r.rules.forEach(rule => allRules.push({ ...rule, ruleset: r.ruleset })));
    const topRules = [...allRules].sort((a, b) => b.remaining - a.remaining).slice(0, 10);

    // Top 10 Files
    const allFiles: (FileSummary & { ruleset: string })[] = [];
    reports.forEach(r => r.files.forEach(f => allFiles.push({ ...f, ruleset: r.ruleset })));
    const topFiles = [...allFiles].sort((a, b) => b.remaining - a.remaining).slice(0, 10);

    const openDrawer = (ruleName: string) => {
        setDrawer({
            isOpen: true,
            ruleName,
            sessionId: sessionId || reports[0]?.sessionId || null,
            compareSessionId: null,
        });
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Overview — {sessionLabel}</h1>
                <p className="page-subtitle">전체 분석 결과 요약</p>
            </div>

            <div className="page-body">
                {/* KPI Cards */}
                <div className="kpi-grid stagger">
                    <div className="kpi-card">
                        <div className="kpi-label">Total Files</div>
                        <div className="kpi-value">{totalFiles.toLocaleString()}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Analyzed Files</div>
                        <div className="kpi-value">{analyzedFiles.toLocaleString()}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Total Functions</div>
                        <div className="kpi-value">{totalFunctions.toLocaleString()}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Lines of Code</div>
                        <div className="kpi-value">{loc.toLocaleString()}</div>
                    </div>
                </div>

                <div className="grid-2col">
                    {/* Ruleset Table */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Ruleset Summary</h3>
                        </div>
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Ruleset</th>
                                        <th className="num">Remaining</th>
                                        <th className="num">Suppressed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rulesetData.map(rs => (
                                        <tr key={rs.ruleset}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rs.ruleset}</td>
                                            <td className="num"><span className="badge badge-danger">{rs.remaining}</span></td>
                                            <td className="num"><span className="badge badge-warning">{rs.suppressed}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Rule Top N Chart */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Rule Top 10 (Remaining)</h3>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topRules} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                                    <XAxis type="number" stroke="#6b6f85" fontSize={11} />
                                    <YAxis
                                        dataKey="rule"
                                        type="category"
                                        stroke="#6b6f85"
                                        fontSize={11}
                                        width={80}
                                        tickFormatter={(v: string) => v.length > 12 ? v.substring(0, 12) + '…' : v}
                                    />
                                    <Tooltip
                                        contentStyle={{ background: '#1e2030', border: '1px solid #2a2d45', borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: '#e8eaf0' }}
                                    />
                                    <Bar dataKey="remaining" radius={[0, 4, 4, 0]} cursor="pointer"
                                        onClick={(_data: unknown, index: number) => openDrawer(topRules[index].rule)}
                                    >
                                        {topRules.map((_, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* File Top N */}
                <div className="card mt-24">
                    <div className="card-header">
                        <h3 className="card-title">File Top 10 (Remaining)</h3>
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>File</th>
                                    <th>Ruleset</th>
                                    <th className="num">Rule Count</th>
                                    <th className="num">Remaining</th>
                                    <th className="num">Suppressed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topFiles.map((f, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 700, color: 'var(--accent-primary-light)' }}>{i + 1}</td>
                                        <td className="truncate" style={{ maxWidth: 300, fontWeight: 500, color: 'var(--text-primary)' }}>{f.file}</td>
                                        <td><span className="badge badge-info">{f.ruleset}</span></td>
                                        <td className="num">{f.ruleCount}</td>
                                        <td className="num"><span className="badge badge-danger">{f.remaining}</span></td>
                                        <td className="num"><span className="badge badge-warning">{f.suppressed}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <RuleDetailDrawer
                drawer={drawer}
                onClose={() => setDrawer(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};

export default OverviewPage;
