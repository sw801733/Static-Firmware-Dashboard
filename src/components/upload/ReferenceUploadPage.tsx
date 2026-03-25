import React, { useState, useRef } from 'react';
import { parseReference } from '../../services/excelParser';
import { saveReferences, getReferences, hasReferences } from '../../services/db';
import type { Reference } from '../../types';

const ReferenceUploadPage: React.FC = () => {
    const [refs, setRefs] = useState<Reference[]>([]);
    const [hasExisting, setHasExisting] = useState<boolean | null>(null);
    const [existingCount, setExistingCount] = useState(0);
    const [status, setStatus] = useState<'idle' | 'parsing' | 'parsed' | 'saving' | 'saved'>('idle');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        (async () => {
            const exists = await hasReferences();
            setHasExisting(exists);
            if (exists) {
                const all = await getReferences();
                setExistingCount(all.length);
            }
        })();
    }, []);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setStatus('parsing');
        setError(null);
        try {
            const parsed = await parseReference(e.target.files[0]);
            const refData: Reference[] = parsed.map(p => ({
                ruleName: p.ruleName,
                ruleNameOriginal: p.ruleNameOriginal,
                ruleset: p.ruleset,
                classification: p.classification,
                justification: p.justification,
            }));
            setRefs(refData);
            setStatus('parsed');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Parse error');
            setStatus('idle');
        }
    };

    const handleSave = async () => {
        setStatus('saving');
        try {
            await saveReferences(refs);
            setStatus('saved');
            setHasExisting(true);
            setExistingCount(refs.length);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Save error');
            setStatus('parsed');
        }
    };

    // Group refs by ruleset for preview
    const grouped = refs.reduce<Record<string, Reference[]>>((acc, r) => {
        (acc[r.ruleset] ??= []).push(r);
        return acc;
    }, {});

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Reference Upload</h1>
                <p className="page-subtitle">위배 유형 분류 현황 파일 (전역 레퍼런스)</p>
            </div>

            <div className="page-body">
                {hasExisting && (
                    <div className="card mb-24 fade-in" style={{ borderColor: 'var(--color-info)', background: 'var(--color-info-bg)', maxWidth: 600 }}>
                        <div style={{ color: 'var(--color-info)', fontWeight: 600 }}>
                            ℹ️ 기존 레퍼런스가 있습니다 ({existingCount}개 규칙). 새로 업로드하면 덮어씁니다.
                        </div>
                    </div>
                )}

                {error && (
                    <div className="card mb-24" style={{ borderColor: 'var(--color-danger)', background: 'var(--color-danger-bg)', maxWidth: 600 }}>
                        <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ {error}</div>
                    </div>
                )}

                {(status === 'idle' || status === 'parsing') && (
                    <div className="card fade-in" style={{ maxWidth: 600 }}>
                        <div className="card-header">
                            <h3 className="card-title">위배 유형 분류 파일 업로드</h3>
                        </div>
                        <div
                            className="file-dropzone"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="file-dropzone-icon">📑</div>
                            <div className="file-dropzone-text">
                                위배 유형 분류 현황 파일 (.xlsx)을 선택하세요
                            </div>
                            <div className="file-dropzone-hint">
                                룰셋별 시트에 규칙명, 유형 분류, 정당화 의견 컬럼 포함
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                style={{ display: 'none' }}
                                onChange={handleFile}
                            />
                        </div>
                        {status === 'parsing' && (
                            <div className="flex-center mt-16 gap-8">
                                <div className="spinner" />
                                <span style={{ color: 'var(--text-muted)' }}>Parsing...</span>
                            </div>
                        )}
                    </div>
                )}

                {status === 'parsed' && refs.length > 0 && (
                    <div className="fade-in" style={{ maxWidth: 800 }}>
                        <div className="card mb-24">
                            <div className="card-header">
                                <h3 className="card-title">Preview</h3>
                                <span className="badge badge-success">{refs.length} rules found</span>
                            </div>

                            {Object.entries(grouped).map(([ruleset, items]) => (
                                <div key={ruleset} className="mb-16">
                                    <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary-light)', marginBottom: 8 }}>
                                        {ruleset} ({items.length})
                                    </h4>
                                    <div className="data-table-wrapper">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>규칙명</th>
                                                    <th>유형 분류</th>
                                                    <th>정당화 의견</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.slice(0, 5).map((r, i) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.ruleNameOriginal}</td>
                                                        <td><span className="badge badge-info">{r.classification || '-'}</span></td>
                                                        <td className="truncate" style={{ maxWidth: 300 }}>{r.justification || '-'}</td>
                                                    </tr>
                                                ))}
                                                {items.length > 5 && (
                                                    <tr>
                                                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                                            ... and {items.length - 5} more
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button className="btn btn-primary" onClick={handleSave}>
                                    💾 Save References
                                </button>
                                <button className="btn btn-secondary" onClick={() => { setStatus('idle'); setRefs([]); }}>
                                    ← Back
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {status === 'saved' && (
                    <div className="empty-state fade-in">
                        <div style={{ fontSize: 64 }}>✅</div>
                        <h3 className="empty-state-title mt-16">레퍼런스 저장 완료!</h3>
                        <p className="empty-state-text">{refs.length}개 규칙의 분류/정당화 정보가 저장되었습니다.</p>
                        <button className="btn btn-secondary mt-24" onClick={() => { setStatus('idle'); setRefs([]); }}>
                            다시 업로드
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReferenceUploadPage;
