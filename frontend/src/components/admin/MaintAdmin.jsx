import { useState, useEffect } from 'react';
import { MAINT_VERSION_KEY } from '../../data/localKeys';
import { getSchedules, fetchSchedules, pushSchedules, runningNow } from '../MaintenanceScreen';
import { toast } from '../Toast';
import { confirmDialog } from '../ConfirmModal';
import { saveLS } from '../../data/safeStorage';
import { dateKey } from '../../data/dateKey';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 점검 종류 셋.
//
// 예전에는 **같은 폼을 세 번 복붙**해뒀다 (날짜 · 시작 시간 · 소요 · 사유 · 요약 · 버튼).
// 다른 것은 색과 아이콘과 기본값뿐인데 450줄 중 200줄 가까이가 그 복사본이었다.
// 한 곳에 적어두고 세 번 그린다.
const KINDS = [
  {
    type: 'regular', icon: '🔧', label: '정기 점검', color: 'var(--accent)', btnText: 'var(--on-accent)',
    desc: '2~3개월 주기. DB 최적화, 보안 업데이트, 시스템 개선',
    defaultMin: 60, defaultReason: '정기 시스템 점검 (DB 최적화, 보안 업데이트)',
  },
  {
    type: 'server', icon: '🖥️', label: '서버 점검', color: 'var(--info)', btnText: 'var(--on-accent)',
    desc: '서버 재시작, 배포, 패치 적용 등',
    defaultMin: 30, defaultReason: '서버 점검 (서버 재시작, 배포, 패치 적용)',
  },
  {
    type: 'emergency', icon: '🚨', label: '긴급 점검', color: 'var(--danger)', btnText: 'var(--on-accent)',
    desc: '서버 장애, 보안 이슈 등 즉각 대응이 필요한 경우',
    defaultMin: 90, defaultReason: '긴급 시스템 점검',
  },
];

const kindOf = (type) => KINDS.find(k => k.type === type) || KINDS[0];

const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

function endTimeOf(time, min) {
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return '--:--';
  const end = h * 60 + m + Number(min || 0);
  return hhmm(Math.floor(end / 60) % 24, end % 60);
}

function dateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

// 종류 하나를 잡는 폼. 셋이 이걸 같이 쓴다
function MaintForm({ kind, onSchedule }) {
  const now = new Date();
  const [date, setDate] = useState(dateKey(now));
  const [time, setTime] = useState(hhmm(now.getHours(), now.getMinutes()));
  const [min, setMin] = useState(kind.defaultMin);
  const [reason, setReason] = useState(kind.defaultReason);

  const startsNow = (() => {
    const t = new Date(`${date}T${time}:00`).getTime();
    return !Number.isNaN(t) && t <= Date.now();
  })();

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12, borderColor: kind.color }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }} aria-hidden="true">{kind.icon}</span>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: kind.color }}>{kind.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{kind.desc}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <label className="label">날짜</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 150 }} />
        </div>
        <div>
          <label className="label">시작 시간</label>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 110 }} />
        </div>
        <div>
          <label className="label">소요 (분)</label>
          <input className="input" type="number" min="1" max="480" value={min} onChange={(e) => setMin(e.target.value)} style={{ width: 70 }} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label className="label">사유</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`${kind.label} 사유`} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        {/* 긴급 점검 요약에 「· 강제 로그아웃」이라고 적혀 있었다.
            점검은 화면을 막을 뿐 **로그아웃시키지 않는다** (토큰을 그대로 둔다).
            화면이 안 하는 일을 한다고 적고 있었다 */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
          {dateLabel(date)} {time} ~ {endTimeOf(time, min)} ({min}분간)
        </div>
        <button
          onClick={() => onSchedule(kind.type, date, time, min, reason)}
          style={{
            background: kind.color, border: 'none', color: kind.btnText,
            padding: '10px 20px', fontSize: 13, fontWeight: 700,
            borderRadius: 'var(--radius)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >{kind.label} {startsNow ? '시작' : '예약'}</button>
      </div>
    </div>
  );
}

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
  // 성공했는지 돌려준다.
  //
  // 부르는 쪽이 `save(...)` 를 **await 없이** 부르고 바로 「추가됐습니다」를 띄우고
  // 있었다. 서버가 거절해도 성공 문구가 먼저 번쩍이고 목록도 되돌아간다 —
  // 사람은 걸린 줄 알고 나간다. 점검은 **모든 사용자를 막는 것**이라 특히 나쁘다.
  const save = async (updated) => {
    const prev = schedules;
    setSchedules(updated);
    try {
      const saved = await pushSchedules(updated);
      setSchedules(saved);
      return true;
    } catch (e) {
      setSchedules(prev);
      toast(e?.response?.data?.error || '점검 설정을 저장하지 못했어요', 'error');
      return false;
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

  const handleSave = async () => {
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
    // 서버가 받아준 뒤에 알린다. 실패하면 save 가 알리고 폼도 안 닫는다
    const isNew = editing === 'new';
    const updated = isNew ? [...schedules, entry] : schedules.map((x, i) => (i === editing ? entry : x));
    const ok = await save(updated);
    if (!ok) return;
    toast(isNew ? '점검 스케줄이 추가됐습니다' : '점검 스케줄이 수정됐습니다');
    setEditing(null);
  };

  // 지우기도 한 번 묻는다. 돌고 있는 점검을 지우면 그 자리에서 앱이 열리고,
  // 예약된 것을 잘못 지우면 아무 일도 안 일어난다 — 둘 다 조용히 벌어진다
  const handleDelete = async (idx) => {
    const s = schedules[idx];
    const when = s?.date ? `${s.date} ` : (s?.days?.length ? `매주 ${s.days.map(d => DAY_LABELS[d]).join('·')} ` : '매일 ');
    const ok = await confirmDialog(
      `${when}${hhmm(s?.startHour ?? 0, s?.startMin ?? 0)} 점검을 지웁니다.\n\n${s?.reason || ''}`,
      { title: '점검 스케줄을 지울까요', confirmText: '지우기' },
    );
    if (!ok) return;
    if (await save(schedules.filter((_, i) => i !== idx))) toast('점검 스케줄이 삭제됐습니다');
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
  const scheduleMaint = async (type, dateStr, timeStr, durationMin, reason) => {
    const dur = Number(durationMin) || 5;
    const [h, m] = String(timeStr).split(':').map(Number);
    // 이 식에서 역슬래시가 빠져 있었다 — `/^d{4}-d{2}-d{2}$/` 는 숫자가 아니라
    // **글자 d 를 네 개** 찾는다. 그래서 `2026-08-27` 같은 진짜 날짜는 전부 걸러지고,
    // 통과하는 문자열은 `dddd-dd-dd` 뿐이었다.
    //
    // 결과: **서버 점검과 긴급 점검을 날짜로 잡는 것이 아예 안 됐다.** 무엇을 넣어도
    // 「날짜와 시작 시간을 확인해 주세요」만 떴다. 에러도 안 나고 빌드도 통과한다
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !Number.isInteger(h) || !Number.isInteger(m)) {
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
    // **사용자 전부를 막는 동작인데 확인이 없었다.** 게다가 세 폼의 기본 시각이
    // 「지금」이라 화면을 열자마자 누르면 그 자리에서 앱이 닫힌다
    const soon = start.getTime() <= Date.now();
    const ok = await confirmDialog(
      `${dateLabel(dateStr)} ${timeStr} 부터 ${dur}분간\n\n` +
      `이 시간 동안 **관리자를 뺀 모든 사람**이 앱을 못 씁니다.\n` +
      `적어둔 기록은 그대로 있고, 끝나면 저절로 열립니다.`,
      {
        title: soon ? `${TYPE_LABEL[type]} 점검을 지금 시작할까요` : `${TYPE_LABEL[type]} 점검을 예약할까요`,
        confirmText: soon ? '지금 시작' : '예약',
      },
    );
    if (!ok) return;

    const entry = {
      date: dateStr,
      startHour: h, startMin: m,
      durationMin: dur,
      days: [],
      reason: reason || `${TYPE_LABEL[type] || '정기'} 시스템 점검`,
      type,
    };
    const updated = [...schedules, entry];
    // 서버가 받아준 뒤에 알린다. 여기가 특히 중요하다 —
    // 「점검 시작!」을 보고 나갔는데 실제로는 안 걸려 있으면 아무도 모른다
    if (!(await save(updated))) return;
    saveLS(MAINT_VERSION_KEY, JSON.stringify(updated));
    toast(soon
      ? `${TYPE_LABEL[type]} 점검 시작! (${dur}분간)`
      : `${TYPE_LABEL[type]} 점검 예약됨 — ${dateStr} ${timeStr} 부터 ${dur}분간`);
  };

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
      {KINDS.map(k => <MaintForm key={k.type} kind={k} onSchedule={scheduleMaint} />)}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>
          <div className="accent-bar" />
          점검 스케줄 ({schedules.length}개)
        </div>
        <button
          onClick={startNew}
          style={{
            background: 'var(--accent)', border: 'none', color: 'var(--on-accent)',
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
                  color: form.days.includes(i) ? 'var(--on-accent)' : 'var(--text-muted)',
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
                background: 'var(--accent)', border: 'none', color: 'var(--on-accent)',
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
          {schedules.map((s, i) => {
            // 목록의 아이콘이 **언제나 🔧** 였다. 긴급(🚨)으로 잡은 것도 목록에서는
            // 정기와 똑같이 보여서, 무엇을 걸어뒀는지 알 수 없었다
            const kind = kindOf(s.type);
            const live = runningNow(s);
            return (
            <div key={i} className="card" style={{ padding: '14px 16px', borderColor: live ? kind.color : 'var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 20 }} aria-hidden="true">{kind.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1.5,
                      color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    }}>
                      {String(s.startHour).padStart(2, '0')}:{String(s.startMin).padStart(2, '0')} ~ {endHour(s)}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({s.durationMin}분)</span>
                      {/* 지금 걸려 있는 것을 표시한다 — 어느 것 때문에 앱이 막혔는지
                          목록만 보고는 알 수 없었다 */}
                      {live && (
                        <span style={{
                          fontFamily: "'Barlow', sans-serif", fontSize: 11, fontWeight: 700,
                          letterSpacing: 0, padding: '2px 8px', borderRadius: 'var(--radius)',
                          background: kind.color, color: kind.btnText,
                        }}>지금 도는 중</span>
                      )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
