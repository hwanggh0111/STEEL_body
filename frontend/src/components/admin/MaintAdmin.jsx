import { useState, useEffect } from 'react';
import { getSchedules, fetchSchedules, pushSchedules } from '../MaintenanceScreen';
import { toast } from '../Toast';
import { saveLS } from '../../data/safeStorage';
import { dateKey } from '../../data/dateKey';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function MaintAdmin() {
  const [schedules, setSchedules] = useState(() => getSchedules());
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    startHour: 4, startMin: 0, durationMin: 60, days: [1, 2, 3, 4, 5], reason: '정기 시스템 점검',
  });

  // 열 때 서버에서 최신 목록을 받아온다 — 다른 기기에서 잡아둔 것도 보여야 한다
  useEffect(() => { fetchSchedules().then(list => setSchedules(list)); }, []);

  // 서버에 올린다. 실패하면 화면을 되돌린다 —
  // 저장한 줄 알았는데 다른 사람에게 안 걸려 있는 것이 제일 나쁘다
  const save = async (updated) => {
    const prev = schedules;
    setSchedules(updated);
    try {
      const saved = await pushSchedules(updated);
      setSchedules(saved);
    } catch (e) {
      setSchedules(prev);
      toast(e?.response?.data?.error || '점검 설정을 저장하지 못했어요', 'error');
    }
  };

  const startNew = () => {
    setForm({ startHour: 4, startMin: 0, durationMin: 60, days: [1, 2, 3, 4, 5], reason: '정기 시스템 점검' });
    setEditing('new');
  };

  const startEdit = (idx) => {
    setForm({ ...schedules[idx] });
    setEditing(idx);
  };

  const handleSave = () => {
    if (!form.reason.trim()) {
      toast('점검 사유를 입력하세요');
      return;
    }
    // 수정 폼은 시각·요일·사유만 다룬다. 원래 항목의 date·type 은 그대로 들고 간다 —
    // 안 그러면 '8월 25일 하루' 짜리가 수정 한 번에 '매일' 로 바뀐다
    const base = editing === 'new' ? {} : (schedules[editing] || {});
    const entry = {
      ...base,
      startHour: Number(form.startHour),
      startMin: Number(form.startMin),
      durationMin: Number(form.durationMin),
      days: form.days,
      reason: form.reason,
    };
    if (editing === 'new') {
      save([...schedules, entry]);
      toast('점검 스케줄이 추가됐습니다');
    } else {
      const updated = [...schedules];
      updated[editing] = entry;
      save(updated);
      toast('점검 스케줄이 수정됐습니다');
    }
    setEditing(null);
  };

  const handleDelete = (idx) => {
    save(schedules.filter((_, i) => i !== idx));
    toast('점검 스케줄이 삭제됐습니다');
  };

  const TYPE_LABEL = { regular: '정기', server: '서버', emergency: '긴급' };

  // 관리자가 고른 날짜와 시작 시간에 점검을 잡는다.
  //
  // 전에는 이 함수가 입력을 통째로 무시하고 now 로 시작했다. 화면에는
  // '8월 25일 03:00 ~ 04:00' 이라고 적혀 있는데 버튼을 누르는 순간 사이트가 닫혔다.
  // 날짜·시간 칸과 요약 줄이 전부 거짓말을 하고 있었다.
  //
  // 날짜를 함께 저장하는 것도 중요하다 — 예전 항목은 date 없이 days: [] 라
  // '매일' 로 읽혀서, 5분짜리 긴급 점검이 다음 날 같은 시각에 또 걸렸다.
  const scheduleMaint = (type, dateStr, timeStr, durationMin, reason) => {
    const dur = Number(durationMin) || 5;
    const [h, m] = String(timeStr).split(':').map(Number);
    if (!/^d{4}-d{2}-d{2}$/.test(dateStr) || !Number.isInteger(h) || !Number.isInteger(m)) {
      toast('날짜와 시작 시간을 확인해 주세요');
      return;
    }
    const start = new Date(`${dateStr}T${timeStr}:00`);
    if (isNaN(start.getTime())) {
      toast('날짜와 시작 시간을 확인해 주세요');
      return;
    }
    // 이미 끝난 시각으로 잡으면 아무 일도 안 일어난다. 걸린 줄 알고 기다리게 두지 않는다
    if (start.getTime() + dur * 60000 <= Date.now()) {
      toast('이미 지난 시각이에요');
      return;
    }
    const entry = {
      date: dateStr,
      startHour: h, startMin: m,
      durationMin: dur,
      days: [],
      reason: reason || `${TYPE_LABEL[type] || '정기'} 시스템 점검`,
      type,
    };
    const updated = [...schedules, entry];
    save(updated);
    saveLS('ironlog_maint_version', JSON.stringify(updated));
    toast(start.getTime() <= Date.now()
      ? `${TYPE_LABEL[type]} 점검 시작! (${dur}분간)`
      : `${TYPE_LABEL[type]} 점검 예약됨 — ${dateStr} ${timeStr} 부터 ${dur}분간`);
  };

  // 버튼 글자를 실제 동작에 맞춘다. 지금이면 '시작', 나중이면 '예약'
  const startsNow = (dateStr, timeStr) => {
    const t = new Date(`${dateStr}T${timeStr}:00`).getTime();
    return !isNaN(t) && t <= Date.now();
  };

  const now = new Date();
  const todayStr = dateKey(now);
  const nowTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const [regularDate, setRegularDate] = useState(todayStr);
  const [regularTime, setRegularTime] = useState(nowTime);
  const [regularMin, setRegularMin] = useState(60);
  const [regularReason, setRegularReason] = useState('정기 시스템 점검 (DB 최적화, 보안 업데이트)');

  const [serverDate, setServerDate] = useState(todayStr);
  const [serverTime, setServerTime] = useState(nowTime);
  const [serverMin, setServerMin] = useState(30);
  const [serverReason, setServerReason] = useState('서버 점검 (서버 재시작, 배포, 패치 적용)');

  const [emergencyDate, setEmergencyDate] = useState(todayStr);
  const [emergencyTime, setEmergencyTime] = useState(nowTime);
  const [emergencyMin, setEmergencyMin] = useState(90);
  const [emergencyReason, setEmergencyReason] = useState('긴급 시스템 점검');

  function getEndTime(time, min) {
    const [h, m] = time.split(':').map(Number);
    const end = h * 60 + m + Number(min);
    return `${String(Math.floor(end / 60) % 24).padStart(2,'0')}:${String(end % 60).padStart(2,'0')}`;
  }

  function getDateLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  }

  const toggleDay = (d) => {
    setForm(f => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d].sort(),
    }));
  };

  // 자정을 넘기면 시가 24 를 넘는다. 그대로 찍으면 '24:50' 이 뜬다
  const endHour = (s) => {
    const end = s.startHour * 60 + s.startMin + s.durationMin;
    return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  };

  return (
    <div>
      {/* 정기 점검 */}
      <div className="card" style={{ padding: 16, marginBottom: 12, borderColor: 'var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>🔧</span>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: 'var(--accent)' }}>정기 점검</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>2~3개월 주기. DB 최적화, 보안 업데이트, 시스템 개선</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <label className="label">날짜</label>
            <input className="input" type="date" value={regularDate} onChange={(e) => setRegularDate(e.target.value)} style={{ width: 150 }} />
          </div>
          <div>
            <label className="label">시작 시간</label>
            <input className="input" type="time" value={regularTime} onChange={(e) => setRegularTime(e.target.value)} style={{ width: 110 }} />
          </div>
          <div>
            <label className="label">소요 (분)</label>
            <input className="input" type="number" min="1" max="480" value={regularMin} onChange={(e) => setRegularMin(e.target.value)} style={{ width: 70 }} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="label">사유</label>
          <input className="input" value={regularReason} onChange={(e) => setRegularReason(e.target.value)} placeholder="정기 점검 사유" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
            {getDateLabel(regularDate)} {regularTime} ~ {getEndTime(regularTime, regularMin)} ({regularMin}분간)
          </div>
          <button onClick={() => scheduleMaint('regular', regularDate, regularTime, regularMin, regularReason)} style={{
            background: 'var(--accent)', border: 'none', color: '#000',
            padding: '10px 20px', fontSize: 13, fontWeight: 700,
            borderRadius: 'var(--radius)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>정기 점검 {startsNow(regularDate, regularTime) ? '시작' : '예약'}</button>
        </div>
      </div>

      {/* 서버 점검 */}
      <div className="card" style={{ padding: 16, marginBottom: 12, borderColor: 'var(--info)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>🖥️</span>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: 'var(--info)' }}>서버 점검</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>서버 재시작, 배포, 패치 적용 등</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <label className="label">날짜</label>
            <input className="input" type="date" value={serverDate} onChange={(e) => setServerDate(e.target.value)} style={{ width: 150 }} />
          </div>
          <div>
            <label className="label">시작 시간</label>
            <input className="input" type="time" value={serverTime} onChange={(e) => setServerTime(e.target.value)} style={{ width: 110 }} />
          </div>
          <div>
            <label className="label">소요 (분)</label>
            <input className="input" type="number" min="1" max="480" value={serverMin} onChange={(e) => setServerMin(e.target.value)} style={{ width: 70 }} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="label">사유</label>
          <input className="input" value={serverReason} onChange={(e) => setServerReason(e.target.value)} placeholder="서버 점검 사유" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
            {getDateLabel(serverDate)} {serverTime} ~ {getEndTime(serverTime, serverMin)} ({serverMin}분간)
          </div>
          <button onClick={() => scheduleMaint('server', serverDate, serverTime, serverMin, serverReason)} style={{
            background: 'var(--info)', border: 'none', color: '#000',
            padding: '10px 20px', fontSize: 13, fontWeight: 700,
            borderRadius: 'var(--radius)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>서버 점검 {startsNow(serverDate, serverTime) ? '시작' : '예약'}</button>
        </div>
      </div>

      {/* 긴급 점검 */}
      <div className="card" style={{ padding: 16, marginBottom: 20, borderColor: 'var(--danger)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>🚨</span>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: 'var(--danger)' }}>긴급 점검</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>서버 장애, 보안 이슈 등 즉각 대응이 필요한 경우</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <label className="label">날짜</label>
            <input className="input" type="date" value={emergencyDate} onChange={(e) => setEmergencyDate(e.target.value)} style={{ width: 150 }} />
          </div>
          <div>
            <label className="label">시작 시간</label>
            <input className="input" type="time" value={emergencyTime} onChange={(e) => setEmergencyTime(e.target.value)} style={{ width: 110 }} />
          </div>
          <div>
            <label className="label">소요 (분)</label>
            <input className="input" type="number" min="1" max="480" value={emergencyMin} onChange={(e) => setEmergencyMin(e.target.value)} style={{ width: 70 }} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="label">사유</label>
          <input className="input" value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} placeholder="긴급 점검 사유" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
            {getDateLabel(emergencyDate)} {emergencyTime} ~ {getEndTime(emergencyTime, emergencyMin)} ({emergencyMin}분간) · 강제 로그아웃
          </div>
          <button onClick={() => scheduleMaint('emergency', emergencyDate, emergencyTime, emergencyMin, emergencyReason)} style={{
            background: 'var(--danger)', border: 'none', color: '#fff',
            padding: '10px 20px', fontSize: 13, fontWeight: 700,
            borderRadius: 'var(--radius)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>긴급 점검 {startsNow(emergencyDate, emergencyTime) ? '시작' : '예약'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>
          <div className="accent-bar" />
          점검 스케줄 ({schedules.length}개)
        </div>
        <button
          onClick={startNew}
          style={{
            background: 'var(--accent)', border: 'none', color: '#000',
            padding: '6px 14px', fontSize: 12, fontWeight: 700,
            borderRadius: 'var(--radius)', cursor: 'pointer',
          }}
        >+ 새 스케줄</button>
      </div>

      {/* 작성/수정 폼 */}
      {editing !== null && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5,
            color: 'var(--accent)', marginBottom: 12,
          }}>
            {editing === 'new' ? '새 점검 스케줄' : '스케줄 수정'}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">시작 시간 (시)</label>
              <input
                className="input" type="number" min="0" max="23"
                value={form.startHour}
                onChange={(e) => setForm({ ...form, startHour: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">시작 분</label>
              <input
                className="input" type="number" min="0" max="59"
                value={form.startMin}
                onChange={(e) => setForm({ ...form, startMin: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">소요 시간 (분)</label>
              <input
                className="input" type="number" min="1" max="480"
                value={form.durationMin}
                onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
              />
            </div>
          </div>

          <label className="label">요일 선택</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '1px solid',
                  borderColor: form.days.includes(i) ? 'var(--accent)' : 'var(--border)',
                  background: form.days.includes(i) ? 'var(--accent)' : 'transparent',
                  color: form.days.includes(i) ? '#000' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >{label}</button>
            ))}
          </div>

          <label className="label">점검 사유</label>
          <input
            className="input"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="예: 정기 시스템 점검, DB 마이그레이션 등"
            style={{ marginBottom: 12 }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              style={{
                background: 'var(--accent)', border: 'none', color: '#000',
                padding: '8px 20px', fontSize: 13, fontWeight: 700,
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }}
            >저장</button>
            <button
              onClick={() => setEditing(null)}
              style={{
                background: 'none', border: '1px solid var(--border)',
                color: 'var(--text-muted)', padding: '8px 16px', fontSize: 13,
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }}
            >취소</button>
          </div>
        </div>
      )}

      {/* 스케줄 목록 */}
      {schedules.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
          등록된 점검 스케줄이 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {schedules.map((s, i) => (
            <div key={i} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🔧</span>
                  <div>
                    <div style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1.5,
                      color: 'var(--text-primary)',
                    }}>
                      {String(s.startHour).padStart(2, '0')}:{String(s.startMin).padStart(2, '0')} ~ {endHour(s)}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>({s.durationMin}분)</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {s.date
                        ? `${s.date} 하루`
                        : s.days && s.days.length > 0 && s.days.length < 7
                          ? `매주 ${s.days.map(d => DAY_LABELS[d]).join(', ')}`
                          : '매일'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => startEdit(i)}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', padding: '4px 10px', fontSize: 11,
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                    }}
                  >수정</button>
                  <button
                    onClick={() => handleDelete(i)}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      color: 'var(--danger)', padding: '4px 10px', fontSize: 11,
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                    }}
                  >삭제</button>
                </div>
              </div>
              <div style={{
                fontSize: 13, color: 'var(--accent)',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
                padding: '6px 12px',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>사유:</span>
                {s.reason || '-'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
