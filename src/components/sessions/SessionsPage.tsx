import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '../../types';
import { getSessions, deleteSession as dbDeleteSession } from '../../services/db';
import { loadFixtures } from '../../services/fixtureLoader';

const SessionsPage: React.FC = () => {
    const [loadingFixtures, setLoadingFixtures] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const loadSessions = async () => {
        setLoading(true);
        const all = await getSessions();
        all.sort((a, b) => b.createdAt - a.createdAt);
        setSessions(all);
        setLoading(false);
    };

    useEffect(() => {
        loadSessions();
    }, []);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('이 세션을 삭제하시겠습니까?')) return;
        await dbDeleteSession(id);
        await loadSessions();
    };

    const handleSelect = (session: Session) => {
        navigate(`/overview?session=${session.id}`);
    };

    const handleLoadFixtures = async () => {
        setLoadingFixtures(true);
        await loadFixtures();
        await loadSessions();
        setLoadingFixtures(false);
    };

    const formatDate = (ts: number) => {
        return new Date(ts).toLocaleDateString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="empty-state">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div className="flex-between">
                    <div>
                        <h1 className="page-title">Analysis Sessions</h1>
                        <p className="page-subtitle">회차별 분석 세션 관리</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="btn btn-secondary"
                            onClick={handleLoadFixtures}
                            disabled={loadingFixtures}
                        >
                            {loadingFixtures ? '⏳ Loading...' : '🧪 Load Demo Data'}
                        </button>
                        <button className="btn btn-primary" onClick={() => navigate('/upload')}>
                            📤 New Session
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-body">
                {sessions.length === 0 ? (
                    <div className="empty-state fade-in">
                        <div className="empty-state-icon">📋</div>
                        <h3 className="empty-state-title">아직 세션이 없습니다</h3>
                        <p className="empty-state-text">
                            "New Session" 버튼을 클릭하여 Project Summary Report를 업로드하세요.
                        </p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                            <button className="btn btn-primary" onClick={() => navigate('/upload')}>
                                📤 첫 세션 만들기
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={handleLoadFixtures}
                                disabled={loadingFixtures}
                            >
                                {loadingFixtures ? '⏳ Loading...' : '🧪 데모 데이터 로드'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="session-grid stagger">
                        {sessions.map(session => (
                            <div
                                key={session.id}
                                className="session-card"
                                onClick={() => handleSelect(session)}
                            >
                                <div className="session-card-id">{session.analysisId}</div>
                                <div className="session-card-date">{formatDate(session.createdAt)}</div>
                                <div className="session-card-rulesets">
                                    {session.rulesetNames.map(rs => (
                                        <span key={rs} className="badge badge-info">{rs}</span>
                                    ))}
                                </div>
                                <div className="session-card-actions">
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleSelect(session)}
                                    >
                                        📊 Overview
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={(e) => handleDelete(session.id, e)}
                                        style={{ color: 'var(--color-danger)' }}
                                    >
                                        🗑
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SessionsPage;
