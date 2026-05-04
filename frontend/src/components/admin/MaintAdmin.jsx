import { useState } from 'react';
import { getSchedules, saveSchedules } from '../MaintenanceScreen';
import { toast } from '../Toast';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function MaintAdmin() {
  const [schedules, setSchedules] = useState(() => getSchedules());
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    startHour: 4, startMin: 0, durationMin: 60, days: [1, 2, 3, 4, 5], reason: '정기 시스템 점검',
  });

  const save = (updated) => {
    setSchedules(updated);
    saveSchedules(updated);
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
    const entry = {
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

  // 즉시 점검 시작 + 긴급공지 자동 생성
  const startNow = (type, durationMin, reason) => {
    const now = new Date();
    const dur = Number(durationMin) || 5;
    const entry = {
      startHour: now.getHours(),
      startMin: now.getMinutes(),
      durationMin: dur,
      days: [],
      reason: reason || (type === 'regular' ? '정기 시스템 점검' : '긴급 시스템 점검'),
      type: type,
    };
    save([...schedules, entry]);
    localStorage.setItem('ironlog_maint_version', JSON.stringify([...schedules, entry]));

    // 긴급공지 자동 저장 (localStorage에 점검 공지 기록)
    const today = now.toISOString().split('T')[0];
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const endMin = now.getHours() * 60 + now.getMinutes() + dur;
    const endTime = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
    const typeLabels = { emergency: '긴급', regular: '정기', server: '서버' };
    const typeLabel = typeLabels[type] || '서버';
    const noticeType = type === 'emergency' ? '긴급공지' : '공지';
    const noticeTitle = `${typeLabel} 서버 점검 (${time}~${endTime})`;
    const noticeContent = type === 'emergency'
      ? `긴급 서버 점검이 ${time}부터 약 ${dur}분간 진행됩니다. 사유: ${entry.reason}. 점검 중 서비스 이용이 제한됩니다. 빠른 복구를 위해 최선을 다하겠습니다.`
      : `${typeLabel} 서버 점검이 ${time}부터 약 ${dur}분간 진행됩니다. 사유: ${entry.reason}. 점검 완료 후 자동으로 서비스가 재개됩니다.`;

    // localStorage에 점검 공지 저장
    const savedNotices = JSON.parse(localStorage.getItem('ironlog_maint_notices') || '[]');
    savedNotices.push({ date: today, title: noticeTitle, type: noticeType, content: noticeContent });
    localStorage.setItem('ironlog_maint_notices', JSON.stringify(savedNotices));

    toast(`${type === 'regular' ? '정기' : '긴급'} 점검 시작! (${dur}분간)`);
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
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

  const endHour = (s) => {
    const end = s.startHour * 60 + s.startMin + s.durationMin;
    return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
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
          <button onClick={() => startNow('regular', regularMin, regularReason)} style={{
            background: 'var(--accent)', border: 'none', color: '#000',
            padding: '10px 20px', fontSize: 13, fontWeight: 700,
            borderRadius: 'var(--radius)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>정기 점검 시작</button>
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
          <button onClick={() => startNow('server', serverMin, serverReason)} style={{
            background: 'var(--info)', border: 'none', color: '#000',
            padding: '10px 20px', fontSize: 13, fontWeight: 700,
            borderRadius: 'var(--radius)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>서버 점검 시작</button>
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
          <button onClick={() => startNow('emergency', emergencyMin, emergencyReason)} style={{
            background: 'var(--danger)', border: 'none', color: '#fff',
            padding: '10px 20px', fontSize: 13, fontWeight: 700,
            borderRadius: 'var(--radius)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>긴급 점검 시작</button>
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
                      {s.days && s.days.length > 0 && s.days.length < 7
                        ? s.days.map(d => DAY_LABELS[d]).join(', ')
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
