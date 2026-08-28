import { useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useInbodyStore } from '../store/inbodyStore';
import { useWorkoutStore } from '../store/workoutStore';
import InbodyCard from '../components/InbodyCard';
import BodyReading from '../components/BodyReading';
import BodyChange from '../components/BodyChange';

import { toast } from '../components/Toast';
import { useToday } from '../data/useToday';
import { scaleFor, positionOn } from '../data/bodyRanges';
import { daysBetween } from '../data/personalRecord';
import { CHART } from '../data/chartColors';

// 무거운 것은 필요할 때 받는다.
// 그래프와 비교 탭은 인바디 화면을 처음 그릴 때 필요하지 않다 —
// 예전에는 둘 다 위에서 import 해서, 입력 폼과 기록 목록이 그것들을 기다렸다.
const CompositionChart = lazy(() => import('../components/InbodyCharts').then(m => ({ default: m.CompositionChart })));
const WeightTrend = lazy(() => import('../components/InbodyCharts').then(m => ({ default: m.WeightTrend })));
const BodyTrend = lazy(() => import('../components/InbodyCharts').then(m => ({ default: m.BodyTrend })));
const ComparePage = lazy(() => import('./ComparePage'));

// 자리를 미리 잡아둔다. 안 그러면 도착하는 순간 아래 내용이 밀려 내려간다
function ChartLoading({ height }) {
  return (
    <div style={{
      height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: 12,
    }}>불러오는 중…</div>
  );
}


// 지난 기록은 한 번에 다 펴지 않는다. 전 기간을 쏟아내면 기록이 쌓일수록
// 아래로 끝없이 늘어진다 — 히스토리를 달력으로 고친 것과 같은 이유다
const LIST_SHOWN = 5;

// ── 체성분 비율 파이차트 (컴포넌트 외부 — 매 렌더 재생성 방지) ──
function getCompositionData(record) {
  if (!record || !record.weight) return null;
  const fatKg = record.fat_pct ? (record.weight * record.fat_pct / 100) : null;
  const muscleKg = record.muscle_kg || null;
  const waterKg = record.water_l || null;
  if (!fatKg && !muscleKg) return null;
  const parts = [];
  if (muscleKg) parts.push({ name: '골격근', value: Number(muscleKg.toFixed(1)), color: CHART.muscle });
  if (fatKg) parts.push({ name: '체지방', value: Number(fatKg.toFixed(1)), color: CHART.fat });
  if (waterKg) parts.push({ name: '체수분', value: Number(waterKg.toFixed(1)), color: CHART.water });
  const known = parts.reduce((s, p) => s + p.value, 0);
  const etc = record.weight - known;
  if (etc > 0) parts.push({ name: '기타(뼈·장기)', value: Number(etc.toFixed(1)), color: CHART.muted });
  return parts;
}

export default function InbodyPage() {
  const location = useLocation();
  const [tab, setTab] = useState('record');
  // 켜둔 채 날이 바뀌면 날짜 칸의 `max` 도 어제에 멈춰서 **오늘을 아예 못 고른다**
  // (useToday 주석 참고)
  const today = useToday();
  const [date, setDate] = useState(today);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [fatPct, setFatPct] = useState('');
  const [muscleKg, setMuscleKg] = useState('');
  const [waterL, setWaterL] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [quickMode, setQuickMode] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [savedQuickMode, setSavedQuickMode] = useState(null);

  // 폼은 접어둔다 — 인바디는 2주에 한 번 적고 그 사이에는 보러 온다.
  // 홈의 「기록하러 가기」로 들어오면 (`state.write`) 펼쳐서 연다
  const [formOpen, setFormOpen] = useState(!!location.state?.write);
  const [listAll, setListAll] = useState(false);
  const weightInputRef = useRef(null);
  // 기록이 하나도 없으면 한 번은 저절로 펼친다. 접힌 단추만 주면 시작할 데가 없다.
  // 사람이 접은 뒤에는 다시 안 연다
  const autoOpenedRef = useRef(false);

  const { records, loading, fetchAll, addRecord, updateRecord, deleteRecord } = useInbodyStore();
  // 「얼마나 달라졌나」가 같은 기간에 운동을 얼마나 했는지도 같이 말한다 (시안 C).
  // 이미 불러오는 중이면 얹힌다 — 홈이나 히스토리를 거쳐 왔으면 벌써 있다
  const workouts = useWorkoutStore(s => s.workouts);
  const fetchWorkouts = useWorkoutStore(s => s.fetchAll);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    if (!useWorkoutStore.getState().loading) fetchWorkouts();
  }, [fetchWorkouts]);

  useEffect(() => {
    if (loading || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    if (records.length === 0) setFormOpen(true);
  }, [loading, records.length]);

  useEffect(() => {
    if (location.state?.write) setFormOpen(true);
  }, [location.state?.write]);

  // 펼친 다음에 초점을 준다. 펼치기 전에 부르면 그 칸이 아직 화면에 없다
  const focusWeightRef = useRef(false);
  useEffect(() => {
    if (!formOpen || !focusWeightRef.current) return;
    focusWeightRef.current = false;
    weightInputRef.current?.focus();
  }, [formOpen]);

  const openForm = () => {
    focusWeightRef.current = true;
    setFormOpen(true);
    setError('');
  };

  const closeForm = () => {
    setFormOpen(false);
    setError('');
  };

  // 간편 모드: 이전 기록에서 키 자동 불러오기
  const lastHeight = useMemo(() => {
    const rec = records.find(r => r.height);
    return rec ? String(rec.height) : '';
  }, [records]);

  const effectiveHeight = height || (quickMode ? lastHeight : '');
  const bmi = effectiveHeight && weight ? (weight / ((effectiveHeight / 100) ** 2)).toFixed(1) : null;

  // BMI 를 뭐라고 부를지.
  //
  // 8/25 에 「신체 분석」을 다시 만들면서 **몸에 등급을 매기지 않기로** 했다.
  // 그런데 이 폼은 그대로 「과체중」 · 「비만」 · 「고도비만」이라고 부르고 있었다 —
  // 같은 화면에서 아래쪽(BodyReading)은 「일반적인 범위」라고 하고 위쪽은 「비만」이라고
  // 하는 상태였다. 눈금을 한 군데서 가져와 말을 맞춘다.
  const bmiBand = useMemo(() => {
    if (!bmi) return null;
    const scale = scaleFor('bmi');
    return scale ? positionOn(scale, Number(bmi)) : null;
  }, [bmi]);

  const bmiColor = bmiBand?.band?.tone === 'low' ? 'var(--info)'
    : bmiBand?.band?.tone === 'high' ? 'var(--warning)'
      : bmiBand ? 'var(--success)' : 'var(--text-muted)';

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
      const payload = {
        date,
        height: effectiveHeight ? Number(effectiveHeight) : null,
        weight: Number(weight),
        fat_pct: fatPct ? Number(fatPct) : null,
        muscle_kg: muscleKg ? Number(muscleKg) : null,
        water_l: waterL ? Number(waterL) : null,
      };
      if (editingId) {
        await updateRecord(editingId, payload);
        toast('인바디 기록 수정 완료!');
        setEditingId(null);
        // 수정 진입 전 quickMode 복원
        if (savedQuickMode !== null) {
          setQuickMode(savedQuickMode);
          setSavedQuickMode(null);
        }
      } else {
        await addRecord(payload);
        toast('인바디 기록 저장!');
      }
      setDate(today); setHeight(''); setWeight(''); setFatPct(''); setMuscleKg(''); setWaterL('');
      // 적고 나면 접는다 — 방금 적은 것이 「지금」과 흐름에 반영된 것을 봐야지,
      // 빈 폼을 다시 들이밀 자리가 아니다
      setFormOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // 카드가 memo 라 핸들러가 매 렌더 바뀌면 memo 가 걸리지 않는다
  const handleEdit = useCallback((record) => {
    // 수정 진입 전 quickMode 백업 (수정 종료 시 복원)
    if (savedQuickMode === null) setSavedQuickMode(quickMode);
    setFormOpen(true);
    setEditingId(record.id);
    setDate(record.date);
    setHeight(record.height ? String(record.height) : '');
    setWeight(String(record.weight));
    setFatPct(record.fat_pct ? String(record.fat_pct) : '');
    setMuscleKg(record.muscle_kg ? String(record.muscle_kg) : '');
    setWaterL(record.water_l ? String(record.water_l) : '');
    setQuickMode(false);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [savedQuickMode, quickMode]);

  const cancelEdit = () => {
    setEditingId(null);
    setFormOpen(false);
    setDate(today);
    setHeight(''); setWeight(''); setFatPct(''); setMuscleKg(''); setWaterL('');
    setError('');
    // 수정 진입 전 quickMode 복원
    if (savedQuickMode !== null) {
      setQuickMode(savedQuickMode);
      setSavedQuickMode(null);
    }
  };

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteRecord(id);
      toast('삭제 완료!');
    } catch {
      toast('삭제하지 못했어요', 'error');
    }
  }, [deleteRecord]);

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

  const compositionData = useMemo(() => getCompositionData(latestRecord), [latestRecord]);

  // 지난 기록에서 얼마나 움직였나. 하나뿐이면 견줄 것이 없다
  const sinceLast = useMemo(() => {
    if (records.length < 2) return null;
    const [a, b] = records;
    if (a?.weight == null || b?.weight == null) return null;
    return Number((a.weight - b.weight).toFixed(1));
  }, [records]);

  const gapDays = latestRecord ? daysBetween(latestRecord.date, today) : null;

  const shownRecords = listAll ? records : records.slice(0, LIST_SHOWN);

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        인바디
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button className={`btn-secondary${tab === 'record' ? ' active' : ''}`}
          onClick={() => setTab('record')} style={{ width: 'auto', fontSize: 12, padding: '6px 16px' }}>기록</button>
        <button className={`btn-secondary${tab === 'compare' ? ' active' : ''}`}
          onClick={() => setTab('compare')} style={{ width: 'auto', fontSize: 12, padding: '6px 16px' }}>비교</button>
      </div>

      {tab === 'compare' && (
        <Suspense fallback={<ChartLoading height={200} />}><ComparePage /></Suspense>
      )}
      {tab === 'record' && <>

      {/* ── 지금 ──
          예전에는 이 화면이 **입력 폼부터** 열렸다. 인바디는 2주에 한 번 적고
          그 사이에는 보러 온다 — 보러 온 사람 앞에 빈 칸부터 들이밀고 있었다.
          지금 몇 kg 인지, 지난번보다 어느 쪽으로 갔는지를 먼저 말한다 */}
      {latestRecord && !formOpen && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: 2, color: 'var(--accent)', lineHeight: 1 }}>
              {latestRecord.weight}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>kg</span>
            {sinceLast !== null && sinceLast !== 0 && (
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                지난 기록보다 {sinceLast > 0 ? '+' : ''}{sinceLast}kg
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: gapDays >= 14 ? 'var(--warning)' : 'var(--text-muted)' }}>
              {gapDays === 0 ? '오늘' : gapDays !== null ? `${gapDays}일 전` : latestRecord.date}
            </span>
          </div>
          {/* 좋고 나쁨은 매기지 않는다. 숫자와 방향만 적는다 */}
          {(latestRecord.fat_pct != null || latestRecord.muscle_kg != null) && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {latestRecord.fat_pct != null && `체지방 ${latestRecord.fat_pct}%`}
              {latestRecord.fat_pct != null && latestRecord.muscle_kg != null && ' · '}
              {latestRecord.muscle_kg != null && `골격근 ${latestRecord.muscle_kg}kg`}
              {latestRecord.bmi != null && ` · BMI ${latestRecord.bmi}`}
            </div>
          )}
        </div>
      )}

      {/* ── 기록하기 ──
          폼은 접어둔다. 기록이 하나도 없으면 처음부터 펼친다 —
          적을 것이 없는 사람에게 접힌 단추만 주면 시작할 데가 없다 */}
      {!formOpen ? (
        <button
          className="btn-primary"
          onClick={() => openForm()}
          style={{ marginBottom: 24 }}
        >{records.length === 0 ? '+ 첫 인바디 기록하기' : '+ 오늘 기록하기'}</button>
      ) : (
        <>
          {editingId && (
            <div style={{
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>✎ 수정 중 ({date})</span>
              <button
                onClick={cancelEdit}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                  padding: '4px 10px', cursor: 'pointer', fontSize: 11, borderRadius: 'var(--radius)' }}
              >취소</button>
            </div>
          )}

          {/* 간편 · 상세가 무엇이 다른지 적는다 — 예전에는 눌러봐야 알았다 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <button className={`btn-secondary${quickMode ? ' active' : ''}`} onClick={() => setQuickMode(true)} style={{ width: 'auto', fontSize: 12, padding: '5px 14px' }}>간편</button>
            <button className={`btn-secondary${!quickMode ? ' active' : ''}`} onClick={() => setQuickMode(false)} style={{ width: 'auto', fontSize: 12, padding: '5px 14px' }}>상세</button>
            {!editingId && (
              <button
                onClick={closeForm}
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, font: 'inherit', fontSize: 12.5, color: 'var(--text-muted)',
                }}
              >접기</button>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            {quickMode
              ? '체중만 적습니다. 키는 지난 기록에서 가져옵니다.'
              : '체중 · 키 · 체지방률 · 골격근량 · 체수분까지 적습니다.'}
          </div>

          <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
            <label className="label">날짜</label>
            <input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 10 }} />

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {!quickMode && (
                <div style={{ flex: 1 }}>
                  <label className="label">키 (cm) <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
                  <input className="input" type="number" inputMode="decimal" step="0.1" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <label className="label">체중 (kg) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input ref={weightInputRef} className="input" type="number" inputMode="decimal" step="0.1" placeholder="70" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
            </div>

            {!quickMode && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">체지방률 (%) <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
                  <input className="input" type="number" inputMode="decimal" step="0.1" placeholder="15" value={fatPct} onChange={(e) => setFatPct(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">골격근량 (kg) <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
                  <input className="input" type="number" inputMode="decimal" step="0.1" placeholder="32" value={muscleKg} onChange={(e) => setMuscleKg(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">체수분 (L) <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(선택)</span></label>
                  <input className="input" type="number" inputMode="decimal" step="0.1" placeholder="40" value={waterL} onChange={(e) => setWaterL(e.target.value)} />
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
                BMI: <strong style={{ color: bmiColor }}>{bmi}</strong>
                {bmiBand?.band?.label && (
                  <span style={{ fontSize: 12, color: bmiColor, marginLeft: 6 }}>({bmiBand.band.label})</span>
                )}
              </div>
            )}

            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}

            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? (editingId ? '수정 중...' : '저장 중...') : (editingId ? '수정 완료' : '기록 저장')}
            </button>
          </form>
        </>
      )}

      {/* ── 체중 흐름 ──
          예전에는 이 그래프가 **화면 맨 아래**, 기록 목록보다도 뒤에 있었다.
          인바디를 보러 오는 이유가 대부분 이건데 스크롤 끝에 뒀었다 */}
      {chartData.length >= 2 && (
        <>
          <div className="section-title">
            <div className="accent-bar" />
            체중 흐름
          </div>
          <div className="card" style={{ marginBottom: 20, padding: 12 }}>
            <Suspense fallback={<ChartLoading height={180} />}>
              <WeightTrend data={chartData} />
            </Suspense>
          </div>
        </>
      )}

      {/* ── 신체 부위별 분석 ── */}
      {latestRecord && (latestRecord.fat_pct || latestRecord.muscle_kg) && (
        <>
          <div className="section-title">
            <div className="accent-bar" />
            내 몸 상태
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            일반적으로 알려진 범위 안에서 지금 어디쯤인지 보여드립니다.
          </div>
          <BodyReading record={latestRecord} prev={records[1]} />
          <div style={{ height: 24 }} />

          <div className="section-title">
            <div className="accent-bar" />
            얼마나 달라졌나
          </div>
          <BodyChange records={records} workouts={workouts} />
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
          <div className="card" style={{ marginBottom: 20, padding: 12 }}>
            <Suspense fallback={<ChartLoading height={280} />}>
              <CompositionChart data={compositionData} total={latestRecord?.weight} />
            </Suspense>
          </div>
        </>
      )}

      {chartData.length >= 2 && chartData.some(d => d.체지방 != null || d.골격근 != null) && (
        <>
          <div className="section-title">
            <div className="accent-bar" />
            체지방 · 골격근 흐름
          </div>
          <div className="card" style={{ marginBottom: 20, padding: 12 }}>
            <Suspense fallback={<ChartLoading height={180} />}>
              <BodyTrend data={chartData} />
            </Suspense>
          </div>
        </>
      )}

      {/* ── 지난 기록 ──
          전 기간을 통째로 쏟아내던 자리다. 기록이 쌓일수록 아래로 끝없이 늘어졌다.
          히스토리를 달력으로 고친 것과 같은 이유로, 여기서는 최근 것부터 조금씩 편다 */}
      <div className="section-title">
        <div className="accent-bar" />
        지난 기록
        {records.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 0 }}>
            {records.length}건
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">기록 없음</div>
          <div className="empty-state-desc">체중부터 한 줄 적어두면 다음부터 흐름이 그려집니다</div>
          <button
            className="btn-primary"
            style={{ marginTop: 12, fontSize: 13, width: 'auto', padding: '10px 20px' }}
            onClick={() => openForm()}
          >+ 첫 인바디 기록하기</button>
        </div>
      ) : (
        <>
          {shownRecords.map((r) => (
            <InbodyCard key={r.id} record={r} onDelete={handleDelete} onEdit={handleEdit} />
          ))}
          {records.length > LIST_SHOWN && (
            <button
              className="btn-secondary"
              onClick={() => setListAll(v => !v)}
              style={{ marginTop: 8 }}
            >{listAll ? '접기' : `지난 기록 ${records.length - LIST_SHOWN}건 더 보기`}</button>
          )}
        </>
      )}

      </>}

    </div>
  );
}
