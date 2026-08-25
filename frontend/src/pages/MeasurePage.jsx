import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import client from '../api/client';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmModal';
import BodySizeSection from '../components/measure/BodySizeSection';
import OneRMSection from '../components/measure/OneRMSection';
import FitnessTestSection from '../components/measure/FitnessTestSection';
import HeartRateSection from '../components/measure/HeartRateSection';
import StopwatchSection from '../components/measure/StopwatchSection';
import FlexibilitySection from '../components/measure/FlexibilitySection';
import ShoulderSection from '../components/measure/ShoulderSection';
import { dateKey } from '../data/dateKey';

// 일곱 가지 도구.
//
// 예전에는 **작은 탭 일곱 개가 옆으로 스크롤**됐다. 무엇이 있는지 한눈에 안 보이고,
// 글자도 11px 에 누르는 자리도 작았다 (앱의 다른 곳은 44px 을 지킨다).
//
// 골라 쓰는 도구 상자에 가깝다고 보고, 격자로 펼쳤다. `desc` 는 그게 뭘 하는지다 —
// 이름만으로는 「어깨 측정」과 「전신 사이즈」가 어떻게 다른지 알 수 없다.
const TABS = [
  { key: 'size', label: '전신 사이즈', desc: '가슴 · 허리 · 팔 · 허벅지 둘레' },
  { key: 'shoulder', label: '어깨 측정', desc: '어깨너비와 허리 대비 비율' },
  { key: 'orm', label: '1RM 계산', desc: '든 무게와 횟수로 최대 중량 환산' },
  { key: 'fitness', label: '체력 테스트', desc: '푸시업 · 플랭크 · 달리기 기록' },
  { key: 'heart', label: '심박수 존', desc: '나이로 유산소 구간 계산' },
  { key: 'stopwatch', label: '스톱워치 · 타이머', desc: '재고 남기기' },
  { key: 'flex', label: '유연성', desc: '앞으로 굽히기 · 스쿼트 깊이' },
];

export default function MeasurePage() {
  const location = useLocation();
  // 검색에서 navigate state로 탭 지정 가능
  // 지정해서 들어오지 않으면 **목록부터** 연다. 예전에는 늘 '전신 사이즈'가 열렸는데,
  // 대부분은 다른 걸 하러 온다
  const initialTab = location.state?.tab || null;
  const [tab, setTab] = useState(initialTab);
  const [measures, setMeasures] = useState([]);
  const [loading, setLoading] = useState(true);

  // location.state.tab 변경 시 탭 동기화 (검색에서 다시 들어올 때)
  useEffect(() => {
    if (location.state?.tab) setTab(location.state.tab);
  }, [location.state?.tab]);

  useEffect(() => {
    client.get('/measures')
      .then(({ data }) => setMeasures(data))
      .catch(() => toast('측정 데이터를 불러오지 못했어요', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filterByType = (type) => measures.filter(m => m.type === type);

  const handleSave = async (type, data) => {
    try {
      const date = data.date || dateKey();
      const payload = { type, date, data };
      await client.post('/measures', payload);
      const { data: refreshed } = await client.get('/measures');
      setMeasures(refreshed);
      toast('저장 완료!');
    } catch {
      toast('저장에 실패했어요', 'error');
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirmDialog('이 측정 기록을 삭제할까요?', { title: '측정 기록 삭제', confirmText: '삭제' });
    if (!ok) return;
    try {
      await client.delete(`/measures/${id}`);
      setMeasures(prev => prev.filter(m => m.id !== Number(id)));
      toast('삭제 완료!');
    } catch {
      toast('삭제에 실패했어요', 'error');
    }
  };

  if (loading) {
    return (
      <div>
        <div className="section-title"><div className="accent-bar" />측정 시스템</div>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title"><div className="accent-bar" />측정 시스템</div>

      {!tab ? (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.7 }}>
            재고 남기는 도구들입니다. 무엇을 하실지 골라주세요.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="card clickable"
                style={{
                  textAlign: 'left', minHeight: 76, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
                  fontFamily: "'Barlow', sans-serif",
                }}
              >
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1.5,
                  color: 'var(--text-primary)',
                }}>{t.label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.desc}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn-secondary" onClick={() => setTab(null)}>‹ 도구 고르기</button>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 1.5,
            color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{TABS.find(t => t.key === tab)?.label}</div>
        </div>
      )}

      {tab === 'size' && <BodySizeSection records={filterByType('bodySize')} onSave={(data) => handleSave('bodySize', data)} onDelete={handleDelete} />}
      {tab === 'shoulder' && <ShoulderSection records={filterByType('shoulder')} onSave={(data) => handleSave('shoulder', data)} onDelete={handleDelete} />}
      {tab === 'orm' && <OneRMSection records={filterByType('oneRM')} onSave={(data) => handleSave('oneRM', data)} />}
      {tab === 'fitness' && <FitnessTestSection records={filterByType('fitness')} onSave={(data) => handleSave('fitness', data)} />}
      {tab === 'heart' && <HeartRateSection />}
      {tab === 'stopwatch' && <StopwatchSection onSave={(data) => handleSave('stopwatch', data)} />}
      {tab === 'flex' && <FlexibilitySection records={filterByType('flexibility')} onSave={(data) => handleSave('flexibility', data)} />}
    </div>
  );
}
