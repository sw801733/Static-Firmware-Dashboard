import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseProjectSummary } from '../../services/excelParser';
import { saveSession, saveRulesetReports } from '../../services/db';
import type { ParsedProjectReport, Session, RulesetReport } from '../../types';

const UploadPage: React.FC = () => {
    const navigate = useNavigate();
    const [analysisId, setAnalysisId] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [parsedReports, setParsedReports] = useState<ParsedProjectReport[]>([]);
    const [step, setStep] = useState<'input' | 'upload' | 'preview' | 'saving'>('input');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
        );
        setFiles(prev => [...prev, ...droppedFiles]);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selected = Array.from(e.target.files);
            setFiles(prev => [...prev, ...selected]);
        }
    };

    const removeFile = (idx: number) => {
        setFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const handleParse = async () => {
        setError(null);
        setStep('preview');
        try {
            const results: ParsedProjectReport[] = [];
            for (const file of files) {
                const parsed = await parseProjectSummary(file);
                results.push(parsed);
            }
            setParsedReports(results);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Parse error');
            setStep('upload');
        }
    };

    const handleSave = async () => {
        setStep('saving');
        try {
            const sessionId = `session-${Date.now()}`;
            const rulesetNames = parsedReports.map(r => r.rulesetName);
            const session: Session = {
                id: sessionId,
                analysisId: analysisId.trim(),
                createdAt: Date.now(),
                rulesetNames,
            };
            await saveSession(session);

            const reports: RulesetReport[] = parsedReports.map(r => ({
                sessionId,
                ruleset: r.rulesetName,
                summary: r.summary,
                rulesetSummary: r.rulesetSummary,
                rules: r.rules,
                files: r.files,
            }));
            await saveRulesetReports(reports);

            navigate(`/overview?session=${sessionId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Save error');
            setStep('preview');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">New Analysis Session</h1>
                <p className="page-subtitle">Project Summary Report 업로드</p>
            </div>

            <div className="page-body">
                {error && (
                    <div className="card mb-24" style={{ borderColor: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                        <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ {error}</div>
                    </div>
                )}

                {/* Step 1: Analysis ID */}
                {(step === 'input' || step === 'upload') && (
                    <div className="card mb-24 fade-in" style={{ maxWidth: 600 }}>
                        <div className="card-header">
                            <h3 className="card-title">Step 1: Analysis ID</h3>
                        </div>
                        <div className="input-group">
                            <label className="input-label">회차 ID (예: #1, #5)</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="#1"
                                value={analysisId}
                                onChange={e => {
                                    setAnalysisId(e.target.value);
                                    if (e.target.value.trim()) setStep('upload');
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Step 2: File Upload */}
                {step === 'upload' && analysisId.trim() && (
                    <div className="card mb-24 fade-in" style={{ maxWidth: 600 }}>
                        <div className="card-header">
                            <h3 className="card-title">Step 2: Upload Reports</h3>
                        </div>

                        <div
                            className="file-dropzone"
                            onDrop={handleDrop}
                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
                            onDragLeave={e => e.currentTarget.classList.remove('dragover')}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="file-dropzone-icon">📁</div>
                            <div className="file-dropzone-text">
                                Project_Summary Report (.xlsx) 파일을 드래그하거나 클릭하세요
                            </div>
                            <div className="file-dropzone-hint">
                                룰셋별 보고서 여러 개를 한번에 업로드할 수 있습니다
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                multiple
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />
                        </div>

                        {files.length > 0 && (
                            <div className="file-list">
                                {files.map((f, i) => (
                                    <div key={i} className="file-item">
                                        <div className="file-item-name">
                                            <span>📄</span>
                                            <span>{f.name}</span>
                                            <span className="badge badge-neutral">{(f.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                        <button className="file-item-remove" onClick={() => removeFile(i)}>✕</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {files.length > 0 && (
                            <button className="btn btn-primary mt-16" onClick={handleParse}>
                                📊 Parse & Preview
                            </button>
                        )}
                    </div>
                )}

                {/* Step 3: Preview */}
                {step === 'preview' && parsedReports.length > 0 && (
                    <div className="fade-in">
                        <div className="card mb-24" style={{ maxWidth: 800 }}>
                            <div className="card-header">
                                <h3 className="card-title">Step 3: Preview</h3>
                                <span className="badge badge-success">{parsedReports.length} rulesets parsed</span>
                            </div>

                            <div className="data-table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Ruleset</th>
                                            <th className="num">Rules</th>
                                            <th className="num">Files</th>
                                            <th className="num">Remaining</th>
                                            <th className="num">Suppressed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedReports.map((r, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.rulesetName}</td>
                                                <td className="num">{r.rules.length}</td>
                                                <td className="num">{r.files.length}</td>
                                                <td className="num">
                                                    <span className="badge badge-danger">{r.rulesetSummary.remaining}</span>
                                                </td>
                                                <td className="num">
                                                    <span className="badge badge-warning">{r.rulesetSummary.suppressed}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                                <button className="btn btn-primary" onClick={handleSave}>
                                    💾 Save Session ({analysisId})
                                </button>
                                <button className="btn btn-secondary" onClick={() => setStep('upload')}>
                                    ← Back
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'saving' && (
                    <div className="empty-state fade-in">
                        <div className="spinner" />
                        <p className="mt-16" style={{ color: 'var(--text-muted)' }}>Saving session...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadPage;
