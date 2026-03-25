import React, { useEffect, useState, useMemo } from 'react';
import type { WorkTask, Session, RulesetReport, Reference, TaskStatus, CompareResult, RuleSummary, RuleDelta } from '../../types';
import { getSessions, getRulesetReportsBySession, getReferences, saveTasks, getAllTasks, updateTaskStatus, clearTasksBySession } from '../../services/db';
import { normalizeRuleName } from '../../services/normalizer';
import { getPriorityLevel } from '../../services/scoring';
import { generateWorkTasks, TASK_TYPE_LABELS } from '../../services/taskGenerator';
import { findSimilarRules, type SimilarRule } from '../../services/ruleSimilarity';

/* ===========================
   Inline compare logic (reused)
   =========================== */

function computeCompareInline(
    currentReports: RulesetReport[],
    previousReports: RulesetReport[]
): CompareResult {
    const currentMap = new Map<string, { remaining: number; suppressed: number }>();
    const previousMap = new Map<string, { remaining: number; suppressed: number }>();

    for (const r of currentReports) {
        for (const rule of r.rules) {
            const key = normalizeRuleName(rule.rule);
            const existing = currentMap.get(key) || { remaining: 0, suppressed: 0 };
            currentMap.set(key, { remaining: existing.remaining + rule.remaining, suppressed: existing.suppressed + rule.suppressed });
        }
    }
    for (const r of previousReports) {
        for (const rule of r.rules) {
            const key = normalizeRuleName(rule.rule);
            const existing = previousMap.get(key) || { remaining: 0, suppressed: 0 };
            previousMap.set(key, { remaining: existing.remaining + rule.remaining, suppressed: existing.suppressed + rule.suppressed });
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
            const rd: RuleDelta = { rule: key, currentRemaining: cur.remaining, previousRemaining: prev.remaining, delta, currentSuppressed: cur.suppressed, previousSuppressed: prev.suppressed };
            if (delta > 0) increasedRules.push(rd);
            else if (delta < 0) decreasedRules.push(rd);
            else unchangedRules.push(rd);
        }
    }
    for (const [key, prev] of previousMap) {
        if (!currentMap.has(key)) removedRules.push({ rule: key, remaining: prev.remaining, suppressed: prev.suppressed });
    }
    increasedRules.sort((a, b) => b.delta - a.delta);
    return { newRules, removedRules, increasedRules, decreasedRules, unchangedRules };
}

/* ===========================
   Component
   =========================== */

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
    TODO: { label: 'TODO', color: '#e8eaf0', bg: 'rgba(108,92,231,0.15)' },
    DOING: { label: 'DOING', color: '#fdcb6e', bg: 'rgba(253,203,110,0.15)' },
    DONE: { label: 'DONE', color: '#55efc4', bg: 'rgba(85,239,196,0.15)' },
    HOLD: { label: 'HOLD', color: '#6b6f85', bg: 'rgba(107,111,133,0.15)' },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
    High: { color: '#ff6b6b', bg: 'rgba(255,107,107,0.15)' },
    Medium: { color: '#fdcb6e', bg: 'rgba(253,203,110,0.15)' },
    Low: { color: '#55efc4', bg: 'rgba(85,239,196,0.15)' },
};

const WorkBoardPage: React.FC = () => {
    const [tasks, setTasks] = useState<WorkTask[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');
    const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null);
    const [similarRules, setSimilarRules] = useState<SimilarRule[]>([]);
    const [references, setReferences] = useState<Reference[]>([]);

    useEffect(() => {
        (async () => {
            const allSessions = await getSessions();
            allSessions.sort((a, b) => b.createdAt - a.createdAt);
            setSessions(allSessions);
            if (allSessions.length > 0) setSelectedSession(allSessions[0].id);

            const allTasks = await getAllTasks();
            setTasks(allTasks);

            const refs = await getReferences();
            setReferences(refs);

            setLoading(false);
        })();
    }, []);

    // Load tasks for selected session
    useEffect(() => {
        if (!selectedSession) return;
        (async () => {
            const allTasks = await getAllTasks();
            setTasks(allTasks);
        })();
    }, [selectedSession]);

    const sessionTasks = useMemo(() => {
        let filtered = tasks.filter(t => t.sessionId === selectedSession);
        if (filterStatus !== 'ALL') {
            filtered = filtered.filter(t => t.status === filterStatus);
        }
        return filtered.sort((a, b) => b.priorityScore - a.priorityScore);
    }, [tasks, selectedSession, filterStatus]);

    const handleGenerate = async () => {
        if (!selectedSession || sessions.length < 2) return;
        setGenerating(true);

        const currentSession = sessions.find(s => s.id === selectedSession);
        const prevSession = sessions.find(s => s.id !== selectedSession);
        if (!currentSession || !prevSession) { setGenerating(false); return; }

        const [curReports, prevReports, refs] = await Promise.all([
            getRulesetReportsBySession(currentSession.id),
            getRulesetReportsBySession(prevSession.id),
            getReferences(),
        ]);

        const compareResult = computeCompareInline(curReports, prevReports);

        // Clear existing tasks for this session
        await clearTasksBySession(selectedSession);

        const newTasks = generateWorkTasks(selectedSession, compareResult, curReports, refs);
        await saveTasks(newTasks);

        const allTasks = await getAllTasks();
        setTasks(allTasks);
        setGenerating(false);
    };

    const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
        await updateTaskStatus(taskId, newStatus);
        const allTasks = await getAllTasks();
        setTasks(allTasks);
    };

    const handleTaskClick = (task: WorkTask) => {
        setSelectedTask(task);
        // Find similar rules for recommendation
        if (task.taskType === 'REF_NEEDED' && references.length > 0) {
            const similar = findSimilarRules(task.rule, references);
            setSimilarRules(similar);
        } else {
            setSimilarRules([]);
        }
    };

    if (loading) return <div className="empty-state"><div className="spinner" /></div>;

    const sessionLabel = sessions.find(s => s.id === selectedSession)?.analysisId || '';
    const statusCounts = {
        TODO: sessionTasks.filter(t => t.status === 'TODO').length,
        DOING: sessionTasks.filter(t => t.status === 'DOING').length,
        DONE: sessionTasks.filter(t => t.status === 'DONE').length,
        HOLD: sessionTasks.filter(t => t.status === 'HOLD').length,
    };

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">Work Board</h1>
                        <p className="page-subtitle">분석 작업 관리</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div className="input-group" style={{ minWidth: 140 }}>
                            <label className="input-label" style={{ fontSize: 11 }}>Session</label>
                            <select className="input" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                                {sessions.map(s => <option key={s.id} value={s.id}>{s.analysisId}</option>)}
                            </select>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={handleGenerate}
                            disabled={generating || sessions.length < 2}
                        >
                            {generating ? '⏳ Generating...' : '🔄 Auto Generate Tasks'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-body">
                {/* Status filter + counters */}
                <div className="workboard-status-bar">
                    {(['ALL', 'TODO', 'DOING', 'DONE', 'HOLD'] as const).map(s => (
                        <button
                            key={s}
                            className={`workboard-status-btn ${filterStatus === s ? 'active' : ''}`}
                            onClick={() => setFilterStatus(s)}
                        >
                            {s === 'ALL' ? `All (${sessionTasks.length})` : `${STATUS_CONFIG[s].label} (${statusCounts[s]})`}
                        </button>
                    ))}
                </div>

                {sessionTasks.length === 0 ? (
                    <div className="empty-state fade-in" style={{ marginTop: 40 }}>
                        <div className="empty-state-icon">📋</div>
                        <h3 className="empty-state-title">작업이 없습니다</h3>
                        <p className="empty-state-text">
                            {sessions.length < 2
                                ? '작업 자동 생성을 위해 최소 2개의 세션이 필요합니다.'
                                : '"Auto Generate Tasks" 버튼을 클릭하여 분석 결과 기반 작업을 생성하세요.'}
                        </p>
                    </div>
                ) : (
                    <div className="workboard-grid">
                        {sessionTasks.map(task => {
                            const priority = getPriorityLevel(task.priorityScore);
                            const prioConfig = PRIORITY_CONFIG[priority];
                            const statusConfig = STATUS_CONFIG[task.status];
                            const typeInfo = TASK_TYPE_LABELS[task.taskType];

                            return (
                                <div
                                    key={task.id}
                                    className={`workboard-card ${selectedTask?.id === task.id ? 'selected' : ''}`}
                                    onClick={() => handleTaskClick(task)}
                                >
                                    <div className="workboard-card-header">
                                        <span className="workboard-card-type">{typeInfo.icon} {typeInfo.label}</span>
                                        <span
                                            className="priority-badge"
                                            style={{ color: prioConfig.color, background: prioConfig.bg }}
                                        >
                                            {priority} ({task.priorityScore})
                                        </span>
                                    </div>
                                    <div className="workboard-card-rule">{task.rule}</div>
                                    <div className="workboard-card-footer">
                                        <select
                                            className="workboard-status-select"
                                            value={task.status}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => handleStatusChange(task.id!, e.target.value as TaskStatus)}
                                            style={{ color: statusConfig.color, background: statusConfig.bg }}
                                        >
                                            {(['TODO', 'DOING', 'DONE', 'HOLD'] as const).map(s => (
                                                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Task detail / Reference recommendation */}
                {selectedTask && (
                    <div className="card mt-24 slide-in">
                        <div className="card-header">
                            <h3 className="card-title">📌 {selectedTask.rule}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTask(null)}>✕</button>
                        </div>
                        <div style={{ padding: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Task Type</span><br />{TASK_TYPE_LABELS[selectedTask.taskType].icon} {TASK_TYPE_LABELS[selectedTask.taskType].label}</div>
                                <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Priority</span><br /><span style={{ color: PRIORITY_CONFIG[getPriorityLevel(selectedTask.priorityScore)].color, fontWeight: 700 }}>{getPriorityLevel(selectedTask.priorityScore)} ({selectedTask.priorityScore})</span></div>
                                <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Session</span><br />{sessionLabel}</div>
                                <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Status</span><br />{STATUS_CONFIG[selectedTask.status].label}</div>
                            </div>

                            {/* Reference Recommendation */}
                            {selectedTask.taskType === 'REF_NEEDED' && (
                                <div style={{ marginTop: 16 }}>
                                    <h4 style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>
                                        💡 Suggested reference rules <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(suggestion only)</span>
                                    </h4>
                                    {similarRules.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>유사한 레퍼런스 규칙을 찾을 수 없습니다.</p>
                                    ) : (
                                        <div className="data-table-wrapper">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Rule</th>
                                                        <th>Classification</th>
                                                        <th>Justification</th>
                                                        <th>Match</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {similarRules.map((sr, i) => (
                                                        <tr key={i}>
                                                            <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{sr.ruleNameOriginal}</td>
                                                            <td><span className="badge badge-info">{sr.classification || '—'}</span></td>
                                                            <td className="truncate" style={{ maxWidth: 300, fontSize: 12 }}>{sr.justification || '—'}</td>
                                                            <td>
                                                                <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                                                                    {sr.matchType === 'prefix' ? '📂 같은 계열' : `🔍 ${Math.round(sr.score * 100)}%`}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkBoardPage;
