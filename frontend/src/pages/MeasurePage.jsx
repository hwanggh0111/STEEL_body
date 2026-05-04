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

const TABS = [
  { key: 'size', label: '전신 사이즈' },
  { key: 'shoulder', label: '어깨 측정' },
  { key: 'orm', label: '1RM 계산' },
  { key: 'fitness', label: '체력 테스트' },
  { key: 'heart', label: '심박수' },
  { key: 'stopwatch', label: '시간 측정' },
  { key: 'flex', label: '유연성' },
];

export default function MeasurePage() {
  const location = useLocation();
  // 검색에서 navigate state로 탭 지정 가능
  const initialTab = location.state?.tab || 'size';
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
      .catch(() => toast('측정 데이터를 불러오지 못했어요'))
      .finally(() => setLoading(false));
  }, []);

  const filterByType = (type) => measures.filter(m => m.type === type);

  const handleSave = async (type, data) => {
    try {
      const date = data.date || new Date().toISOString().split('T')[0];
      const payload = { type, date, data };
      await client.post('/measures', payload);
      const { data: refreshed } = await client.get('/measures');
      setMeasures(refreshed);
      toast('저장 완료!');
    } catch {
      toast('저장에 실패했어요');
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
      toast('삭제에 실패했어요');
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

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} className={`btn-secondary${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)} style={{ fontSize: 11, padding: '5px 12px', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

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
