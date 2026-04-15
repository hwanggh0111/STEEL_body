import { useState, useEffect, useMemo } from 'react';
import { useInbodyStore } from '../store/inbodyStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import InbodyCard from '../components/InbodyCard';
import BodyAnalysis from '../components/BodyAnalysis';
import ComparePage from './ComparePage';
import Toast, { toast } from '../components/Toast';

export default function InbodyPage() {
  const [tab, setTab] = useState('record');
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [fatPct, setFatPct] = useState('');
  const [muscleKg, setMuscleKg] = useState('');
  const [waterL, setWaterL] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [quickMode, setQuickMode] = useState(true);

  const { records, loading, fetchAll, addRecord, deleteRecord } = useInbodyStore();

  useEffect(() => { fetchAll(); }, []);

  // 간편 모드: 이전 기록에서 키 자동 불러오기
  const lastHeight = useMemo(() => {
    const rec = records.find(r => r.height);
    return rec ? String(rec.height) : '';
  }, [records]);

  const effectiveHeight = height || (quickMode ? lastHeight : '');
  const bmi = effectiveHeight && weight ? (weight / ((effectiveHeight / 100) ** 2)).toFixed(1) : null;

  function getBmiColor(bmi) {
    if (!bmi) return 'var(--text-muted)';
    if (bmi < 18.5) return 'var(--info)';
    if (bmi < 23) return 'var(--success)';
    if (bmi < 25) return 'var(--warning)';
    return 'var(--danger)';
  }

  function getBmiLabel(bmi) {
    if (!bmi) return '';
    if (bmi < 18.5) return '저체중';
    if (bmi < 23) return '정상';
    if (bmi < 25) return '과체중';
    if (bmi < 30) return '비만';
    return '고도비만';
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!weight) {
      setError('체중은 필수에요');
      return;
    }
    const w = Number(weight);
    if (isNaN(w) || w <= 0 || w > 500) {
      setError('체중은 0~500kg 범위여야 해요');
      return;
    }
    if (effectiveHeight) {
      const h = Number(effectiveHeight);
      if (isNaN(h) || h <= 0 || h > 300) {
        setError('키는 0~300cm 범위여야 해요');
        return;
      }
    }
    if (fatPct && (Number(fatPct) < 0 || Number(fatPct) > 60)) {
      setError('체지방률은 0~60% 범위여야 해요');
      return;
    }
    setSaving(true);
    try {
      await addRecord({
        date,
        height: effectiveHeight ? Number(effectiveHeight) : null,
        weight: Number(weight),
        fat_pct: fatPct ? Number(fatPct) : null,
        muscle_kg: muscleKg ? Number(muscleKg) : null,
        water_l: waterL ? Number(waterL) : null,
      });
      toast('인바디 기록 저장!');
      setHeight(''); setWeight(''); setFatPct(''); setMuscleKg(''); setWaterL('');
    } catch (err) {
      setError(err.response?.data?.error || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('정말 삭제하시겠어요?')) return;
    try {
      await deleteRecord(id);
      toast('삭제 완료!');
    } catch {
      toast('삭제 실패');
    }
  };

  // 그래프용 데이터 (날짜 오래된순)
  const chartData = useMemo(() => [...records].reverse().map(r => ({
    date: r.date.slice(5),
    체중: r.weight,
    체지방: r.fat_pct,
    골격근: r.muscle_kg,
    BMI: r.bmi,
    체수분: r.water_l,
  })), [records]);


  const latestRecord = records.length > 0 ? records[0] : null;

  // ── 체성분 비율 파이차트 ──
  function getCompositionData(record) {
    if (!record || !record.weight) return null;
    const fatKg = record.fat_pct ? (record.weight * record.fat_pct / 100) : null;
    const muscleKg = record.muscle_kg || null;
    const waterKg = record.water_l || null;
    if (!fatKg && !muscleKg) return null;
    const parts = [];
    if (muscleKg) parts.push({ name: '골격근', value: Number(muscleKg.toFixed(1)), color: '#3a9e3a' });
    if (fatKg) parts.push({ name: '체지방', value: Number(fatKg.toFixed(1)), color: '#e84040' });
    if (waterKg) parts.push({ name: '체수분', value: Number(waterKg.toFixed(1)), color: '#4a9aff' });
    const known = parts.reduce((s, p) => s + p.value, 0);
    const etc = record.weight - known;
    if (etc > 0) parts.push({ name: '기타(뼈·장기)', value: Number(etc.toFixed(1)), color: '#666' });
    return parts;
  }

  const compositionData = useMemo(() => getCompositionData(latestRecord), [latestRecord]);


  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        인바디
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button className={`btn-secondary${tab === 'record' ? ' active' : ''}`}
          onClick={() => setTab('record')} style={{ fontSize: 12, padding: '6px 16px' }}>기록</button>
        <button className={`btn-secondary${tab === 'compare' ? ' active' : ''}`}
          onClick={() => setTab('compare')} style={{ fontSize: 12, padding: '6px 16px' }}>비교</button>
      </div>

      {tab === 'compare' && <ComparePage />}
      {tab === 'record' && <>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button className={`btn-secondary${quickMode ? ' active' : ''}`} onClick={() => setQuickMode(true)} style={{ fontSize: 12, padding: '5px 14px' }}>간편</button>
        <button className={`btn-secondary${!quickMode ? ' active' : ''}`} onClick={() => setQuickMode(false)} style={{ fontSize: 12, padding: '5px 14px' }}>상세</button>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <label className="label">날짜</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 10 }} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {!quickMode && (
            <div style={{ flex: 1 }}>
              <label className="label">키 (cm) <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
              <input className="input" type="number" step="0.1" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <label className="label">체중 (kg) <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input className="input" type="number" step="0.1" placeholder="70" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
        </div>

        {!quickMode && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">체지방률 (%) <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
              <input className="input" type="number" step="0.1" placeholder="15" value={fatPct} onChange={(e) => setFatPct(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">골격근량 (kg) <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
              <input className="input" type="number" step="0.1" placeholder="32" value={muscleKg} onChange={(e) => setMuscleKg(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">체수분 (L) <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
              <input className="input" type="number" step="0.1" placeholder="40" value={waterL} onChange={(e) => setWaterL(e.target.value)} />
            </div>
          </div>
        )}

        {quickMode && lastHeight && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            키: {lastHeight}cm (이전 기록 사용)
          </div>
        )}

        {bmi && (
          <div style={{ marginBottom: 10, fontSize: 14 }}>
            BMI: <strong style={{ color: getBmiColor(Number(bmi)) }}>{bmi}</strong>
            <span style={{ fontSize: 12, color: getBmiColor(Number(bmi)), marginLeft: 6 }}>({getBmiLabel(Number(bmi))})</span>
          </div>
        )}

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}

        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? '저장 중...' : '기록 저장'}
        </button>
      </form>

      {/* ── 신체 부위별 분석 ── */}
      {latestRecord && (latestRecord.fat_pct || latestRecord.muscle_kg) && (
        <>
          <div className="section-title">
            <div className="accent-bar" />
            신체 분석
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            인바디 측정 결과를 기반으로 부위별 상태를 분석합니다. 신체 부위를 터치하면 상세 설명을 볼 수 있어요.
          </div>
          <BodyAnalysis record={latestRecord} />
          <div style={{ height: 16 }} />
        </>
      )}


      {/* ── 체성분 비율 ── */}
      {compositionData && (
        <>
          <div className="section-title">
            <div className="accent-bar" />
            체성분 비율
          </div>
          <div className="card" style={{ marginBottom: 16, padding: 12 }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={compositionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}kg`}
                >
                  {compositionData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}
                  formatter={(value, name) => [`${value}kg`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* 범례 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
              {compositionData.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {entry.name} {entry.value}kg ({(entry.value / latestRecord.weight * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 기록 히스토리 */}
      <div className="section-title">
        <div className="accent-bar" />
        기록 히스토리
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">데이터 없음</div>
          <div className="empty-state-desc">체중 변화를 기록하고 추이를 확인해보세요</div>
          <button className="btn-primary" style={{ marginTop: 12, fontSize: 13 }} onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}>+ 첫 인바디 기록하기</button>
        </div>
      ) : (
        records.map((r) => (
          <InbodyCard key={r.id} record={r} onDelete={handleDelete} />
        ))
      )}

      {/* ── 변화 추이 그래프 ── */}
      {chartData.length >= 2 && (
        <>
          <div className="section-title" style={{ marginTop: 24 }}>
            <div className="accent-bar" />
            체중 변화 추이
          </div>
          <div className="card" style={{ marginBottom: 16, padding: 12 }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }} />
                <Line type="monotone" dataKey="체중" stroke="#ff6b1a" strokeWidth={2} dot={{ fill: '#ff6b1a', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {chartData.some(d => d.체지방 != null) && (
            <>
              <div className="section-title">
                <div className="accent-bar" />
                체지방 / 골격근 변화
              </div>
              <div className="card" style={{ marginBottom: 16, padding: 12 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }} />
                    <Legend formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{v}</span>} />
                    {chartData.some(d => d.체지방 != null) && <Line type="monotone" dataKey="체지방" stroke="#e84040" strokeWidth={2} dot={{ fill: '#e84040', r: 3 }} />}
                    {chartData.some(d => d.골격근 != null) && <Line type="monotone" dataKey="골격근" stroke="#3a9e3a" strokeWidth={2} dot={{ fill: '#3a9e3a', r: 3 }} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}


      </>}

      <Toast />
    </div>
  );
}
