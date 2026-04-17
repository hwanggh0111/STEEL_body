import { useState, useEffect } from 'react';

const MAINT_KEY = 'ironlog_maintenance';

const DEFAULT_SCHEDULE = [];

export function getSchedules() {
  try {
    const saved = JSON.parse(localStorage.getItem(MAINT_KEY));
    // localStorage에 저장된 스케줄이 없으면 기본값 사용하고 저장
    if (!saved || saved.length === 0) {
      localStorage.setItem(MAINT_KEY, JSON.stringify(DEFAULT_SCHEDULE));
      return DEFAULT_SCHEDULE;
    }
    return saved;
  } catch { return DEFAULT_SCHEDULE; }
}

// 기본 스케줄 강제 적용 (테스트용)
export function forceDefaultSchedule() {
  localStorage.setItem(MAINT_KEY, JSON.stringify(DEFAULT_SCHEDULE));
}

// 앱 시작 시 기본 스케줄과 localStorage 동기화
// DEFAULT_SCHEDULE이 코드에서 바뀌면 자동 반영 (빈 배열이면 건너뜀 — 사용자 설정 보존)
const MAINT_VERSION_KEY = 'ironlog_maint_version';
const CURRENT_VERSION = JSON.stringify(DEFAULT_SCHEDULE);
if (DEFAULT_SCHEDULE.length > 0 && localStorage.getItem(MAINT_VERSION_KEY) !== CURRENT_VERSION) {
  localStorage.setItem(MAINT_KEY, CURRENT_VERSION);
  localStorage.setItem(MAINT_VERSION_KEY, CURRENT_VERSION);
}

export function saveSchedules(schedules) {
  localStorage.setItem(MAINT_KEY, JSON.stringify(schedules));
}

function getMaintenanceInfo() {
  const schedules = getSchedules();
  const now = new Date();
  const day = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const schedule of schedules) {
    if (schedule.days && schedule.days.length > 0 && !schedule.days.includes(day)) continue;
    const startMin = schedule.startHour * 60 + schedule.startMin;
    const endMin = startMin + schedule.durationMin;
    if (nowMin >= startMin && nowMin < endMin) {
      const remainSec = (endMin - nowMin) * 60 - now.getSeconds();
      const endHour = Math.floor(endMin / 60);
      const endMinute = endMin % 60;
      return {
        active: true,
        remainSec,
        startTime: `${String(schedule.startHour).padStart(2, '0')}:${String(schedule.startMin).padStart(2, '0')}`,
        endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
        durationMin: schedule.durationMin,
        reason: schedule.reason || '정기 시스템 점검',
        type: schedule.type || 'regular',
      };
    }
  }
  return { active: false };
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${String(m).padStart(2, '0')}분 ${String(s).padStart(2, '0')}초`;
  return `${m}분 ${String(s).padStart(2, '0')}초`;
}

import { isAdmin as isAdminUser } from '../data/admin';

export default function MaintenanceScreen({ children }) {
  const [info, setInfo] = useState(() => getMaintenanceInfo());
  const [kicked, setKicked] = useState(false);

  const admin = isAdminUser();

  useEffect(() => {
    const timer = setInterval(() => {
      const newInfo = getMaintenanceInfo();
      setInfo(newInfo);

      // 관리자는 강제 로그아웃 안 함
      if (admin) return;

      // 점검 시작되면 차단 (로그아웃은 하지 않음 - 토큰 유지)
      if (newInfo.active && !kicked) {
        setKicked(true);
      }
      // 점검 끝나면 자동 복구
      if (!newInfo.active && kicked) {
        setKicked(false);
        window.location.reload();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [kicked, admin]);

  // 관리자는 점검 중에도 통과
  if (admin) return children;

  if (!info.active) return children;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#0a0a0a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999999, padding: 20,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        {/* 로고 */}
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: 6,
          background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 12px rgba(255,107,26,0.3))',
          marginBottom: 32,
        }}>
          STEEL BODY
        </div>

        {/* 아이콘 */}
        <div style={{ fontSize: 64, marginBottom: 20 }}>
          {info.type === 'emergency' ? '🚨' : info.type === 'server' ? '🖥️' : '🔧'}
        </div>

        {/* 제목 */}
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 28, letterSpacing: 3,
          color: info.type === 'emergency' ? 'var(--danger)' : info.type === 'server' ? 'var(--info)' : 'var(--accent)',
          marginBottom: 12,
        }}>
          {info.type === 'emergency' ? '긴급 점검 중' : info.type === 'server' ? '서버 점검 중' : '정기 점검 중'}
        </div>

        <div style={{
          fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8,
          marginBottom: 16,
        }}>
          잠시 후 다시 이용해주세요.
        </div>

        {/* 점검 공지 */}
        <div style={{
          background: info.type === 'emergency' ? 'rgba(232,64,64,0.1)' : info.type === 'server' ? 'rgba(74,154,255,0.1)' : 'rgba(255,107,26,0.1)',
          border: '1px solid',
          borderColor: info.type === 'emergency' ? 'var(--danger)' : info.type === 'server' ? 'var(--info)' : 'var(--accent)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          marginBottom: 20,
          textAlign: 'left',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px',
              borderRadius: 'var(--radius)',
              background: info.type === 'emergency' ? 'var(--danger)' : info.type === 'server' ? 'var(--info)' : 'var(--accent)',
              color: info.type === 'emergency' ? '#fff' : '#000',
            }}>{info.type === 'emergency' ? '긴급공지' : info.type === 'server' ? '서버공지' : '점검공지'}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {info.type === 'emergency' ? '긴급 서버 점검 안내' : info.type === 'server' ? '서버 점검 안내' : '정기 서버 점검 안내'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {info.type === 'emergency'
              ? '현재 긴급 서버 점검이 진행 중입니다. 서비스 안정화를 위해 일시적으로 이용이 제한됩니다. 빠른 시간 내에 복구하겠습니다.'
              : info.type === 'server'
              ? '서버 점검이 진행 중입니다. 서버 재시작, 배포, 패치 적용 등의 작업이 이루어지고 있습니다. 잠시만 기다려주세요.'
              : '더 나은 서비스를 위해 정기 점검을 진행하고 있습니다. 점검 완료 후 자동으로 서비스가 재개됩니다.'}
          </div>
          <div style={{
            fontSize: 12, marginTop: 8, padding: '6px 10px',
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
            color: info.type === 'emergency' ? 'var(--danger)' : 'var(--accent)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>사유:</span>
            {info.reason}
          </div>
        </div>

        {/* 점검 시간 */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 24px',
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>점검 시간</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 24, letterSpacing: 2,
            color: 'var(--text-primary)',
          }}>
            {info.startTime} ~ {info.endTime}
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
              ({info.durationMin}분)
            </span>
          </div>
        </div>

        {/* 남은 시간 */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)',
          padding: '16px 24px',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>남은 시간</div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28, letterSpacing: 2,
            color: 'var(--accent)',
          }}>
            {formatTime(Math.max(0, info.remainSec))}
          </div>

          {/* 프로그레스 바 */}
          <div style={{
            marginTop: 12, height: 4, background: 'var(--bg-tertiary)',
            borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.max(0, (1 - info.remainSec / (info.durationMin * 60)) * 100)}%`,
              background: 'linear-gradient(90deg, var(--accent), #ffd700)',
              borderRadius: 2,
              transition: 'width 1s linear',
            }} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16 }}>
          점검이 끝나면 자동으로 복구됩니다
        </div>
      </div>
    </div>
  );
}
