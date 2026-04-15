import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { NOTICES, NOTICE_BADGE, NOTICE_READ_KEY, getAllNotices, addAdminNotice, deleteNotice as deleteNoticeFromStore } from '../data/notices';
import { getSchedules, saveSchedules } from '../components/MaintenanceScreen';
import Toast, { toast } from '../components/Toast';
import SecurityPanel from '../components/SecurityPanel';
import HackingSecurityPanel from '../components/HackingSecurityPanel';
import AiAdminPanel from '../components/AiAdminPanel';
import AiNoticeWriter from '../components/AiNoticeWriter';

import { isAdmin as checkAdmin } from '../data/admin';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function AdminPage() {
  const { nickname } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('notice');

  const isAdmin = checkAdmin();

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
          letterSpacing: 2, color: 'var(--danger)', marginBottom: 8,
        }}>ACCESS DENIED</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          관리자 전용 페이지입니다.
          <br />접근 권한이 없습니다.
        </div>
        <button
          onClick={() => navigate('/home')}
          className="btn-primary"
          style={{ width: 'auto', padding: '10px 24px' }}
        >홈으로 돌아가기</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
          letterSpacing: 2, color: 'var(--accent)', margin: 0, marginBottom: 4,
        }}>ADMIN</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          공지사항 · 점검 · 보안 · 해킹보안 관리
        </p>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'notice', label: '공지사항 관리', icon: '📢' },
          { key: 'maint', label: '점검 스케줄', icon: '🔧' },
          { key: 'security', label: '보안 관리', icon: '🛡️' },
          { key: 'hacking', label: '해킹 보안', icon: '🔒' },
          { key: 'ai', label: 'AI 관리자', icon: '🤖' },
          { key: 'ainotice', label: 'AI 공지', icon: '📝' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px', borderRadius: 'var(--radius)',
              border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              borderColor: tab === t.key ? 'var(--accent)' : 'var(--border)',
              background: tab === t.key ? 'var(--accent)' : 'transparent',
              color: tab === t.key ? '#000' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'notice' && <NoticeAdmin />}
      {tab === 'maint' && <MaintAdmin />}
      {tab === 'security' && <SecurityPanel />}
      {tab === 'hacking' && <HackingSecurityPanel />}
      {tab === 'ai' && <AiAdminPanel />}
      {tab === 'ainotice' && <AiNoticeWriter />}

      <Toast />
    </div>
  );
}

// ─── 공지사항 관리 ───
function NoticeAdmin() {
  const [notices, setNotices] = useState(() => getAllNotices());
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', type: '공지', content: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const types = ['공지', '긴급공지', '업데이트', '신기능', '이벤트'];

  const reload = () => setNotices(getAllNotices());

  const startNew = () => {
    setForm({ title: '', type: '공지', content: '' });
    setEditing('new');
  };

  const startEdit = (notice) => {
    setForm({ title: notice.title, type: notice.type, content: notice.content });
    setEditing(notice.id);
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast('제목과 내용을 입력하세요');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (editing === 'new') {
      const maxId = notices.reduce((max, n) => Math.max(max, n.id), 0);
      const newNotice = { id: maxId + 1, date: today, ...form };
      addAdminNotice(newNotice);
      toast('공지사항이 추가됐습니다! 공지사항 페이지에 바로 반영됩니다.');
    } else {
      // 수정: 기존 삭제 후 새로 추가
      deleteNoticeFromStore(editing);
      const updated = { id: editing, date: new Date().toISOString().split('T')[0], ...form };
      addAdminNotice(updated);
      toast('공지사항이 수정됐습니다');
    }
    setEditing(null);
    reload();
  };

  const handleDelete = (id) => {
    deleteNoticeFromStore(id);
    setConfirmDelete(null);
    reload();
    toast('공지사항이 삭제됐습니다');
  };

  const resetRead = () => {
    localStorage.removeItem(NOTICE_READ_KEY);
    localStorage.removeItem('ironlog_notice_count');
    toast('읽음 기록 초기화 완료! 홈에서 전체 공지 팝업이 다시 뜹니다');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>
          <div className="accent-bar" />
          공지사항 목록 ({notices.length}개)
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={resetRead}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', padding: '6px 12px', fontSize: 11,
              borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >읽음 초기화</button>
          <button
            onClick={startNew}
            style={{
              background: 'var(--accent)', border: 'none', color: '#000',
              padding: '6px 14px', fontSize: 12, fontWeight: 700,
              borderRadius: 'var(--radius)', cursor: 'pointer',
            }}
          >+ 새 공지</button>
        </div>
      </div>

      {/* 작성/수정 폼 */}
      {editing !== null && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5,
            color: 'var(--accent)', marginBottom: 12,
          }}>
            {editing === 'new' ? '새 공지 작성' : '공지 수정'}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">제목</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="공지 제목"
              />
            </div>
            <div style={{ width: 120 }}>
              <label className="label">유형</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{ height: 38 }}
              >
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <label className="label">내용</label>
          <textarea
            className="input"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="공지 내용을 입력하세요"
            rows={4}
            style={{ resize: 'vertical' }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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

      {/* 공지 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...notices].reverse().map(n => (
          <div key={n.id} className="card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={NOTICE_BADGE[n.type] || 'badge badge-accent'}>{n.type}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.date}</span>
                <button
                  onClick={() => startEdit(n)}
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', padding: '3px 8px', fontSize: 10,
                    borderRadius: 'var(--radius)', cursor: 'pointer',
                  }}
                >수정</button>
                {confirmDelete === n.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(n.id)}
                      style={{
                        background: 'var(--danger)', border: 'none',
                        color: '#fff', padding: '3px 8px', fontSize: 10,
                        borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 700,
                      }}
                    >확인</button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{
                        background: 'none', border: '1px solid var(--border)',
                        color: 'var(--text-muted)', padding: '3px 8px', fontSize: 10,
                        borderRadius: 'var(--radius)', cursor: 'pointer',
                      }}
                    >취소</button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(n.id)}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      color: 'var(--danger)', padding: '3px 8px', fontSize: 10,
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                    }}
                  >삭제</button>
                )}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{n.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 점검 스케줄 관리 ───
function MaintAdmin() {
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
