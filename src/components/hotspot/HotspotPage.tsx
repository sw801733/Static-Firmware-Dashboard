import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { RulesetReport, FileSummary, DrawerState, Session } from '../../types';
import { getRulesetReportsBySession, getSessions } from '../../services/db';
import RuleDetailDrawer from '../common/RuleDetailDrawer';

const COLORS = ['#6c5ce7', '#00cec9', '#fd79a8', '#fdcb6e', '#74b9ff', '#55efc4', '#e17055', '#a29bfe', '#ff6b6b', '#ffa502'];

interface AggregatedFile {
    file: string;
    remaining: number;
    ruleCount: number;
    suppressed: number;
    rulesets: string[];
}

const HotspotPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [reports, setReports] = useState<RulesetReport[]>([]);
    const [prevReports, setPrevReports] = useState<RulesetReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [sessionLabel, setSessionLabel] = useState('');
    const [prevSessionId, setPrevSessionId] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [drawer, setDrawer] = useState<DrawerState>({ isOpen: false, ruleName: null, sessionId: null, compareSessionId: null });

    useEffect(() => {
        (async () => {
            const allSessions = await getSessions();
            allSessions.sort((a, b) => b.createdAt - a.createdAt);
            setSessions(allSessions);

            const sessionId = searchParams.get('session');
            const targetSession = sessionId
                ? allSessions.find(s => s.id === sessionId) || allSessions[0]
                : allSessions[0];

            if (!targetSession) { setLoading(false); return; }

            const r = await getRulesetReportsBySession(targetSession.id);
            setReports(r);
            setSessionLabel(targetSession.analysisId);

            // Load previous session for delta
            const prevSession = allSessions.find(s => s.id !== targetSession.id);
            if (prevSession) {
                setPrevSessionId(prevSession.id);
                const pr = await getRulesetReportsBySession(prevSession.id);
                setPrevReports(pr);
            }

            setLoading(false);
        })();
    }, [searchParams]);

    // Handle previous session change
    useEffect(() => {
        if (!prevSessionId) return;
        (async () => {
            const pr = await getRulesetReportsBySession(prevSessionId);
            setPrevReports(pr);
        })();
    }, [prevSessionId]);

    const { allFiles, prevFileMap } = useMemo(() => {
        // Aggregate current files
        const fileMap = new Map<string, { remaining: number; ruleCount: number; suppressed: number; rulesets: string[] }>();
        for (const r of reports) {
            for (const f of r.files) {
                const existing = fileMap.get(f.file) || { remaining: 0, ruleCount: 0, suppressed: 0, rulesets: [] };
                existing.remaining += f.remaining;
                existing.ruleCount += f.ruleCount;
                existing.suppressed += f.suppressed;
                if (!existing.rulesets.includes(r.ruleset)) existing.rulesets.push(r.ruleset);
                fileMap.set(f.file, existing);
            }
        }
        const allFiles: AggregatedFile[] = Array.from(fileMap.entries()).map(([file, data]) => ({ file, ...data }));

        // Aggregate previous files
        const prevMap = new Map<string, { remaining: number; ruleCount: number }>();
        for (const r of prevReports) {
            for (const f of r.files) {
                const existing = prevMap.get(f.file) || { remaining: 0, ruleCount: 0 };
                existing.remaining += f.remaining;
                existing.ruleCount += f.ruleCount;
                prevMap.set(f.file, existing);
            }
        }

        return { allFiles, prevFileMap: prevMap };
    }, [reports, prevReports]);

    const topByRemaining = useMemo(() =>
        [...allFiles].sort((a, b) => b.remaining - a.remaining).slice(0, 15), [allFiles]);
    const topByRuleCount = useMemo(() =>
        [...allFiles].sort((a, b) => b.ruleCount - a.ruleCount).slice(0, 15), [allFiles]);

    // Previous top files for "NEW" badge detection
    const prevTopSet = useMemo(() => {
        const sorted = [...prevFileMap.entries()].sort((a, b) => b[1].remaining - a[1].remaining);
        return new Set(sorted.slice(0, 15).map(([f]) => f));
    }, [prevFileMap]);

    // File detail
    const selectedFileDetails: (FileSummary & { ruleset: string })[] = [];
    if (selectedFile) {
        for (const r of reports) {
            const f = r.files.find(f => f.file === selectedFile);
            if (f) selectedFileDetails.push({ ...f, ruleset: r.ruleset });
        }
    }

    if (loading) return <div className="empty-state"><div className="spinner" /></div>;
    if (reports.length === 0) return (
        <div className="empty-state fade-in">
            <div className="empty-state-icon">🔥</div>
            <h3 className="empty-state-title">데이터가 없습니다</h3>
        </div>
    );

    const hasPrevSession = prevReports.length > 0;

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">Hotspot — {sessionLabel}</h1>
                        <p className="page-subtitle">파일별 위배 집중도 분석</p>
                    </div>
                    {sessions.length >= 2 && (
                        <div className="input-group" style={{ minWidth: 180 }}>
                            <label className="input-label" style={{ fontSize: 11 }}>비교 대상</label>
                            <select className="input" value={prevSessionId} onChange={e => setPrevSessionId(e.target.value)}>
                                <option value="">없음</option>
                                {sessions.filter(s => s.analysisId !== sessionLabel).map(s => (
                                    <option key={s.id} value={s.id}>{s.analysisId}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="page-body">
                <div className="grid-2col">
                    {/* Remaining Top */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">🔥 File Top 15 (Remaining)</h3>
                        </div>
                        <div className="chart-container" style={{ height: 400 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topByRemaining} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
                                    <XAxis type="number" stroke="#6b6f85" fontSize={11} />
                                    <YAxis
                                        dataKey="file"
                                        type="category"
                                        stroke="#6b6f85"
                                        fontSize={10}
                                        width={120}
                                        tickFormatter={(v: string) => {
                                            const parts = v.split('/');
                                            return parts[parts.length - 1].substring(0, 18);
                                        }}
                                    />
                                    <Tooltip
                                        contentStyle={{ background: '#1e2030', border: '1px solid #2a2d45', borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: '#e8eaf0' }}
                                    />
                                    <Bar dataKey="remaining" radius={[0, 4, 4, 0]}
                                        cursor="pointer"
                                        onClick={(_data: unknown, index: number) => setSelectedFile(topByRemaining[index].file)}
                                    >
                                        {topByRemaining.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Rule Count Top */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">📋 File Top 15 (Rule Count)</h3>
                        </div>
                        <div className="chart-container" style={{ height: 400 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topByRuleCount} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
                                    <XAxis type="number" stroke="#6b6f85" fontSize={11} />
                                    <YAxis
                                        dataKey="file"
                                        type="category"
                                        stroke="#6b6f85"
                                        fontSize={10}
                                        width={120}
                                        tickFormatter={(v: string) => {
                                            const parts = v.split('/');
                                            return parts[parts.length - 1].substring(0, 18);
                                        }}
                                    />
                                    <Tooltip
                                        contentStyle={{ background: '#1e2030', border: '1px solid #2a2d45', borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: '#e8eaf0' }}
                                    />
                                    <Bar dataKey="ruleCount" radius={[0, 4, 4, 0]}
                                        cursor="pointer"
                                        onClick={(_data: unknown, index: number) => setSelectedFile(topByRuleCount[index].file)}
                                    >
                                        {topByRuleCount.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Selected file detail */}
                {selectedFile && (
                    <div className="card mt-24 slide-in">
                        <div className="card-header">
                            <h3 className="card-title">📂 {selectedFile}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFile(null)}>✕ Close</button>
                        </div>
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Ruleset</th>
                                        <th className="num">Rule Count</th>
                                        <th className="num">Remaining</th>
                                        <th className="num">Suppressed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedFileDetails.map((d, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.ruleset}</td>
                                            <td className="num">{d.ruleCount}</td>
                                            <td className="num"><span className="badge badge-danger">{d.remaining}</span></td>
                                            <td className="num"><span className="badge badge-warning">{d.suppressed}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Full file table with delta */}
                <div className="card mt-24">
                    <div className="card-header">
                        <h3 className="card-title">All Files</h3>
                        <span className="badge badge-neutral">{allFiles.length} files</span>
                    </div>
                    <div className="data-table-wrapper" style={{ maxHeight: 500, overflowY: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>File</th>
                                    <th className="num">Remaining</th>
                                    {hasPrevSession && <th className="num">Δ Rem</th>}
                                    <th className="num">Rule Count</th>
                                    {hasPrevSession && <th className="num">Δ Rules</th>}
                                    <th className="num">Suppressed</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...allFiles].sort((a, b) => b.remaining - a.remaining).map((f, i) => {
                                    const prev = prevFileMap.get(f.file);
                                    const remDelta = prev ? f.remaining - prev.remaining : 0;
                                    const ruleDelta = prev ? f.ruleCount - prev.ruleCount : 0;
                                    const isNewInTop = i < 15 && !prevTopSet.has(f.file) && hasPrevSession;

                                    return (
                                        <tr key={f.file} onClick={() => setSelectedFile(f.file)} style={{ cursor: 'pointer' }}>
                                            <td style={{ fontWeight: 700, color: 'var(--accent-primary-light)' }}>{i + 1}</td>
                                            <td className="truncate" style={{ maxWidth: 300, fontWeight: 500, color: 'var(--text-primary)' }}>{f.file}</td>
                                            <td className="num"><span className="badge badge-danger">{f.remaining}</span></td>
                                            {hasPrevSession && (
                                                <td className={`num ${remDelta > 0 ? 'delta-positive' : remDelta < 0 ? 'delta-negative' : ''}`}>
                                                    {prev ? (remDelta > 0 ? '+' : '') + remDelta : '—'}
                                                </td>
                                            )}
                                            <td className="num">{f.ruleCount}</td>
                                            {hasPrevSession && (
                                                <td className={`num ${ruleDelta > 0 ? 'delta-positive' : ruleDelta < 0 ? 'delta-negative' : ''}`}>
                                                    {prev ? (ruleDelta > 0 ? '+' : '') + ruleDelta : '—'}
                                                </td>
                                            )}
                                            <td className="num">{f.suppressed}</td>
                                            <td>
                                                {isNewInTop && <span className="badge badge-warning" style={{ fontSize: 10 }}>🆕 NEW</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
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

export default HotspotPage;
