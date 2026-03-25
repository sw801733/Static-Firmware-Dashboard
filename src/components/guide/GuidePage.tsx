import React from 'react';

const GuidePage: React.FC = () => {
    return (
        <div style={{ padding: '32px', maxWidth: '850px', margin: '0 auto', color: 'var(--text-color)' }}>
            <div className="page-header" style={{ marginBottom: '40px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <h1 className="page-title" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
                    Static Firmware Dashboard 사용자 가이드
                </h1>
                <p className="page-subtitle" style={{ color: 'var(--text-muted)' }}>
                    효율적인 정적 코드 분석 결과 관리를 위한 가이드
                </p>
            </div>

            <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '48px', lineHeight: '1.7' }}>
                
                {/* 1) 시작하기 */}
                <section>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🚀</span> 1) 시작하기
                    </h2>
                    
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>지원 파일</h3>
                        <ul style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li><strong>Project Summary Report.xlsx</strong>: 세션 생성용 필수 파일</li>
                            <li><strong>Reference.xlsx (선택)</strong>: 규칙 매핑 기준 업로드 파일</li>
                        </ul>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>기본 흐름</h3>
                        <ol style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li><strong>Upload</strong>에서 분석 리포트를 업로드해 세션을 생성합니다.</li>
                            <li><strong>Overview / Compare / Hotspot / Trends</strong>에서 데이터를 탐색합니다.</li>
                            <li><strong>Work Board</strong>에서 개선 작업 우선순위를 관리합니다.</li>
                        </ol>
                    </div>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

                {/* 2) 메뉴별 사용법 */}
                <section>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🧭</span> 2) 메뉴별 사용법
                    </h2>

                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Sessions <code>(/)</code></h3>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                <li>저장된 분석 세션 목록을 확인합니다.</li>
                                <li><code>New Session</code> 버튼으로 신규 업로드를 시작합니다.</li>
                                <li>데모 데이터가 필요하면 <code>Load Demo Data</code>를 사용합니다.</li>
                            </ul>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Upload <code>(/upload)</code></h3>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                <li><code>Project Summary Report</code> 파일을 업로드해 세션을 생성합니다.</li>
                                <li>업로드 후 파싱이 완료되면 분석 화면으로 이동할 수 있습니다.</li>
                            </ul>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Upload Reference <code>(/reference)</code></h3>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                <li>기준 규칙(Reference) 파일을 업로드합니다.</li>
                                <li>Compare / Work Board에서 매핑 정확도를 높이는 데 도움이 됩니다.</li>
                            </ul>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Overview <code>(/overview)</code></h3>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                <li>세션의 핵심 지표(KPI), 규칙셋별 현황, 위반 요약을 확인합니다.</li>
                                <li>현재 세션을 빠르게 진단할 때 가장 먼저 확인하면 좋습니다.</li>
                            </ul>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Compare <code>(/compare)</code></h3>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                <li>규칙셋 간 결과 차이를 비교합니다.</li>
                                <li>공통/상충/누락 항목을 바탕으로 규칙 통합 전략을 세울 수 있습니다.</li>
                            </ul>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Hotspot <code>(/hotspot)</code></h3>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                <li>집중 개선이 필요한 영역(핫스팟)을 우선순위로 확인합니다.</li>
                                <li>영향도가 높은 항목부터 정리해 단기간 개선 효과를 얻을 수 있습니다.</li>
                            </ul>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Trends <code>(/trends)</code></h3>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                <li>세션/규칙 기준의 추세를 확인합니다.</li>
                                <li>품질 지표가 개선되고 있는지 주기적으로 모니터링할 때 사용합니다.</li>
                            </ul>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Work Board <code>(/workboard)</code></h3>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                <li>개선 항목을 작업 단위로 관리합니다.</li>
                                <li>상태(예: 대기/진행/완료)와 우선순위를 정해 실행 계획을 운영합니다.</li>
                            </ul>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>User Guide <code>(/guide)</code></h3>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                <li>현재 문서의 요약 버전을 앱 내에서 바로 확인할 수 있는 페이지입니다.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

                {/* 3) 추천 운영 방식 */}
                <section>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>💡</span> 3) 추천 운영 방식
                    </h2>

                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>주간 루틴 예시</h3>
                        <ol style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>신규 리포트 업로드로 세션 생성</li>
                            <li>Overview에서 주요 경고량과 변동 확인</li>
                            <li>Compare/Hotspot으로 개선 타깃 도출</li>
                            <li>Work Board에 작업 등록 및 담당 지정</li>
                            <li>다음 주 Trends로 개선 결과 검증</li>
                        </ol>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>데이터 품질 팁</h3>
                        <ul style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>동일 포맷의 리포트 파일명을 팀 내 규칙으로 통일하세요.</li>
                            <li>Reference 파일은 버전명을 포함해 관리하세요. (예: <code>reference_v2026-03.xlsx</code>)</li>
                            <li>세션 생성 시점/배포 시점을 함께 기록하면 회귀 분석이 쉬워집니다.</li>
                        </ul>
                    </div>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

                {/* 4) 자주 발생하는 이슈 */}
                <section>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>❓</span> 4) 자주 발생하는 이슈
                    </h2>

                    <ul style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <li>
                            <strong>파일 업로드 후 결과가 비어 보이는 경우</strong>
                            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>- 엑셀 시트명/열 구조가 기대 포맷과 다른지 확인하세요.</p>
                        </li>
                        <li>
                            <strong>비교 화면에서 매핑이 기대와 다른 경우</strong>
                            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>- 최신 Reference 파일을 다시 업로드해 보세요.</p>
                        </li>
                        <li>
                            <strong>세션이 너무 많아 관리가 어려운 경우</strong>
                            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>- Sessions 화면에서 오래된 세션을 정리하고, 주차/릴리스 기준으로 네이밍 규칙을 사용하세요.</p>
                        </li>
                    </ul>
                </section>
                
            </div>
        </div>
    );
};

export default GuidePage;
