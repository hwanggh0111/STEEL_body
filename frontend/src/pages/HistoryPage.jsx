import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import StatBox from '../components/StatBox';
import WeightChart from '../components/WeightChart';
import WorkoutCard from '../components/WorkoutCard';
import MonthCalendar from '../components/MonthCalendar';
import { toast } from '../components/Toast';
import { readLS } from '../data/safeStorage';
import { shiftMonth, monthSummary, monthsWithRecords } from '../data/monthGrid';
import { dateKey } from '../data/dateKey';

// 히스토리.
//
// 이름도 「히스토리」고 앱 소개에도 **「달력으로 되짚는다 — 빠진 날이 눈에 보여야
// 안 빠진다」**고 적어뒀는데, 정작 화면은 날짜별 목록이었다.
// **빠진 날은 아예 안 그려지니 눈에 보일 수가 없었다.**
//
// 달력을 앞에 세웠다. 날짜를 누르면 그날 것만 보고, 안 누르면 그 달 전체를 본다.
// 거르기와 CSV 내보내기는 그대로 뒀다 — 되던 것을 없애지 않는다.
export default function HistoryPage() {
  const navigate = useNavigate();
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts, deleteWorkout } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();
  }, []);

  const [filterExercise, setFilterExercise] = useState('');

  const handleExportCSV = (type = 'workouts') => {
    const filename = type === 'inbody' ? 'steelbody_inbody.csv' : 'steelbody_workouts.csv';
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    const token = readLS('token');
    fetch(`${baseURL}/export/${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        // 문서에 붙이지 않은 링크는 클릭해도 아무 일이 안 일어나는 브라우저가 있다.
        // 그리고 곧바로 revoke 하면 내려받기가 시작되기 전에 주소가 사라져 빈 파일이 된다
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast(`${type === 'inbody' ? '인바디' : '운동'} CSV 내보내기 완료!`);
      })
      .catch(() => toast('내보내기에 실패했어요', 'error'));
  };

  const allExercises = useMemo(() => [...new Set(Object.values(workouts).flat().map(w => w.exercise).filter(Boolean))].sort(), [workouts]);

  const dates = useMemo(() => workouts ? Object.keys(workouts).sort().reverse() : [], [workouts]);

  // 보고 있는 달. 처음에는 이번 달을 연다
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDate, setSelectedDate] = useState(null);

  const summary = useMemo(() => monthSummary(workouts, ym.year, ym.month), [workouts, ym]);
  // 기록이 있는 달만 안다. 텅 빈 달을 화살표로 계속 넘기지 않게 「기록이 있는 달로」를 준다
  const monthsWith = useMemo(() => monthsWithRecords(workouts), [workouts]);
  const thisYm = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
  const nearestWith = monthsWith.find(m => m < thisYm) || monthsWith[0] || null;

  const goMonth = (by) => {
    setYm(prev => shiftMonth(prev.year, prev.month, by));
    setSelectedDate(null);
  };

  // 걸러낸 결과를 미리 세운다.
  // 예전에는 날짜를 돌면서 빈 날을 null 로 건너뛰기만 했다. 그래서 고른 운동이
  // 한 번도 없으면 목록 자리가 통째로 비어서 화면이 죽은 것처럼 보였다
  // 고른 날이 있으면 그 하루만, 없으면 보고 있는 달 전체.
  // 예전에는 언제나 전 기간을 쏟아냈다 — 기록이 쌓일수록 아래로 끝없이 늘어졌다
  const shownDates = useMemo(() => {
    const prefix = `${ym.year}-${String(ym.month).padStart(2, '0')}-`;
    const pool = selectedDate ? [selectedDate] : dates.filter(d => d.startsWith(prefix));
    return pool
      .map(date => [date, filterExercise
        ? (workouts[date] || []).filter(w => w.exercise === filterExercise)
        : (workouts[date] || [])])
      .filter(([, list]) => list.length > 0);
  }, [dates, workouts, filterExercise, ym, selectedDate]);
  const totalDays = dates.length;
  const totalWorkouts = useMemo(() => workouts ? Object.values(workouts).flat().length : 0, [workouts]);

  // 카드가 memo 라, 이 함수가 매 렌더 새로 만들어지면 memo 가 아무 일도 못 한다
  const handleDelete = useCallback(async (id) => {
    try {
      await deleteWorkout(id);
      toast('삭제 완료!');
    } catch {
      toast('삭제하지 못했어요', 'error');
    }
  }, [deleteWorkout]);

  const loading = wLoading || iLoading;

  return (
    <div>
      {/* ── 달력 ── */}
      <div className="section-title">
        <div className="accent-bar" />
        운동 달력
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button className="btn-secondary" onClick={() => goMonth(-1)} aria-label="지난 달">‹</button>
        <div style={{
          flexGrow: 1, textAlign: 'center',
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
          color: 'var(--text-primary)',
        }}>{ym.year}년 {ym.month}월</div>
        <button className="btn-secondary" onClick={() => goMonth(1)} aria-label="다음 달">›</button>
      </div>

      <MonthCalendar
        year={ym.year}
        month={ym.month}
        workouts={workouts}
        selected={selectedDate}
        onSelect={setSelectedDate}
      />

      {/* 그 달 요약 — 아무것도 없으면 기록이 있는 달로 데려다준다 */}
      {summary.days > 0 ? (
        <div className="card" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
            이 달에 <span style={{ color: 'var(--accent)' }}>{summary.days}일</span> 나오셨어요
            <span style={{ color: 'var(--text-muted)' }}> · {summary.count}건 · {summary.sets}세트</span>
          </div>
          {summary.volumeKg > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              총 볼륨 {summary.volumeKg >= 1000 ? `${(summary.volumeKg / 1000).toFixed(1)}톤` : `${summary.volumeKg}kg`}
              {summary.bodyweightSets > 0 && (
                <span style={{ color: 'var(--text-muted)' }}> · 맨몸 {summary.bodyweightSets}세트는 빠짐</span>
              )}
            </div>
          )}
          {summary.parts.length > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {summary.parts.slice(0, 4).map(p => `${p.part} ${Math.round(p.ratio * 100)}%`).join(' · ')}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flexGrow: 1, fontSize: 13, color: 'var(--text-muted)' }}>
            이 달에는 기록이 없어요.
          </div>
          {nearestWith && (
            <button
              className="btn-secondary"
              style={{ flexShrink: 0 }}
              onClick={() => {
                const [y, m] = nearestWith.split('-').map(Number);
                setYm({ year: y, month: m });
                setSelectedDate(null);
              }}
            >{nearestWith.replace('-', '년 ')}월로</button>
          )}
        </div>
      )}

      <div className="section-title" style={{ marginTop: 24 }}>
        <div className="accent-bar" />
        {selectedDate ? `${selectedDate.slice(5).replace('-', '월 ')}일 기록` : `${ym.month}월 기록`}
        {selectedDate && (
          <button
            className="btn-secondary"
            style={{ marginLeft: 'auto', padding: '4px 10px' }}
            onClick={() => setSelectedDate(null)}
          >이 달 전체</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select className="input" value={filterExercise} onChange={e => setFilterExercise(e.target.value)}
          style={{ flex: 1, fontSize: 13 }}>
          <option value="">전체 운동</option>
          {allExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        {filterExercise && (
          <button onClick={() => setFilterExercise('')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        )}
        <button
          onClick={() => handleExportCSV('workouts')}
          className="btn-secondary"
          style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }}
        >
          운동 CSV
        </button>
        <button
          onClick={() => handleExportCSV('inbody')}
          className="btn-secondary"
          style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }}
        >
          인바디 CSV
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      ) : dates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">기록 없음</div>
          <div className="empty-state-desc">아직 운동 기록이 없어요</div>
          <button className="btn-primary" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('/workout')}>+ 첫 운동 기록하기</button>
        </div>
      ) : shownDates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">기록 없음</div>
          <div className="empty-state-desc">
            {filterExercise
              ? `여기서는 '${filterExercise}' 을(를) 한 기록이 없어요`
              : selectedDate ? '이 날은 쉬셨네요' : '이 달에는 기록이 없어요'}
          </div>
          {filterExercise && (
            <button className="btn-secondary" style={{ marginTop: 12, fontSize: 13 }} onClick={() => setFilterExercise('')}>거르기 풀기</button>
          )}
        </div>
      ) : (
        shownDates.map(([date, filtered]) => {
          return (
            <div key={date} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 6, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1.5 }}>
                {date}
              </div>
              {filtered.map((w) => (
                <WorkoutCard key={w.id} workout={w} onDelete={handleDelete} />
              ))}
            </div>
          );
        })
      )}

      {/* 통계와 체중 변화는 되짚는 재료지 본론이 아니다. 달력 아래로 내렸다 */}
      <div style={{ height: 8 }} />
      <div className="section-title">
        <div className="accent-bar" />
        통계
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
        <StatBox number={totalDays} label="운동일" />
        <StatBox number={totalWorkouts} label="총 운동" />
        <StatBox number={records.length} label="인바디" />
      </div>

      <div className="section-title">
        <div className="accent-bar" />
        체중 변화
      </div>
      <div className="card" style={{ marginBottom: 24, padding: 12 }}>
        <WeightChart records={records} />
      </div>

    </div>
  );
}
