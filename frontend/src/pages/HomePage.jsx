import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import StatBox from '../components/StatBox';
import Badges from '../components/Badges';
import LevelSystem from '../components/LevelSystem';
import MissionSystem from '../components/MissionSystem';
import NoticeBanner, { NoticePopup } from '../components/NoticeBanner';
import { NOTICES, getReadNotices, markNoticeRead } from '../data/notices';
import { isAdmin } from '../data/admin';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// 초성 추출
function getChosung(str) {
  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  return [...str].map(c => {
    const code = c.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return c;
    return CHO[Math.floor(code / 588)];
  }).join('');
}

function matchSearch(q, item) {
  const ql = q.toLowerCase();
  // 라벨, 키워드 직접 매칭
  if (item.label.toLowerCase().includes(ql)) return true;
  if (item.keywords.some(k => k.toLowerCase().includes(ql))) return true;
  // 초성 매칭
  const labelChosung = getChosung(item.label);
  if (labelChosung.includes(ql)) return true;
  if (item.keywords.some(k => getChosung(k).includes(ql))) return true;
  return false;
}

const SEARCH_ITEMS = [
  // ─── 메인 페이지 ───
  { label: '홈', keywords: ['홈', '메인', 'home', 'main', '대시보드', 'dashboard', '홈화면'], path: '/home', icon: '🏠' },
  { label: '루틴 추천', keywords: ['루틴', '추천', 'routine', '분할', '운동루틴', '프로그램', '루', '추'], path: '/routine', icon: '📋' },
  { label: '운동 기록', keywords: ['운동', '기록', 'workout', '세트', '횟수', '중량', 'record', '운', '기'], path: '/workout', icon: '🏋️' },
  { label: '인바디', keywords: ['인바디', 'inbody', '체중', '체지방', '골격근', '근육량', 'weight', 'body', '인', '체', 'BMI', 'bmi'], path: '/inbody', icon: '📊' },
  { label: '홈트레이닝', keywords: ['홈트', '홈트레이닝', 'home training', '맨몸', '집운동', '홈워크아웃', '트레이닝'], path: '/homeworkout', icon: '🏠' },
  { label: '운동 검색', keywords: ['검색', 'search', '운동찾기', '부위', '근육', '찾기'], path: '/search', icon: '🔍' },
  { label: '측정 시스템', keywords: ['측정', 'measure', '시스템'], path: '/measure', icon: '📐' },
  { label: '히스토리', keywords: ['히스토리', 'history', '기록', '과거', '이력', '달력', '히'], path: '/history', icon: '📅' },
  { label: '공지사항', keywords: ['공지', '알림', 'notice', '소식', '업데이트', '공'], path: '/notice', icon: '📢' },
  { label: '이벤트', keywords: ['이벤트', 'event', '챌린지', 'challenge', '출시', '미션', '도장', '출석', '보상', 'launch'], path: '/event', icon: '🎉' },

  // ─── 측정 시스템 서브 기능 (탭 자동 선택) ───
  { label: '전신 사이즈', keywords: ['전신', '사이즈', '둘레', '가슴', '허리', '엉덩이', '팔둘레', '허벅지', '종아리', '목둘레'], path: '/measure', tab: 'size', icon: '📏' },
  { label: '어깨 측정', keywords: ['어깨', 'shoulder', '견봉', '어깨너비', '문짝', '광배', '비율'], path: '/measure', tab: 'shoulder', icon: '💪' },
  { label: '1RM 계산', keywords: ['1rm', '1RM', '최대중량', 'one rep max', '벤치프레스', '스쿼트', '데드리프트', '숄더프레스', 'brzycki'], path: '/measure', tab: 'orm', icon: '🔢' },
  { label: '체력 테스트', keywords: ['체력', '테스트', '푸시업', '풀업', '플랭크', '달리기', '윗몸일으키기', '시트업', '스쿼트', 'fitness'], path: '/measure', tab: 'fitness', icon: '🏃' },
  { label: '심박수 존', keywords: ['심박수', '심박', 'heart rate', '존', 'zone', '최대심박', '안정심박', '유산소', 'bpm'], path: '/measure', tab: 'heart', icon: '❤️' },
  { label: '스톱워치 / 타이머', keywords: ['스톱워치', 'stopwatch', '타이머', 'timer', '시간', '랩', 'lap'], path: '/measure', tab: 'stopwatch', icon: '⏱️' },
  { label: '유연성 측정', keywords: ['유연성', 'flexibility', '앉아 앞으로 굽히기', '스트레칭', '스쿼트 깊이'], path: '/measure', tab: 'flex', icon: '🧘' },

  // ─── 홈 내부 섹션 (현재 페이지 스크롤) ───
  { label: '레벨 시스템', keywords: ['레벨', 'level', '경험치', 'exp', '티어', 'tier', '랭크', 'rank', '입문', '초보', '중급', '상급', '엘리트', '전설', '불멸', '신화', '초월', '만렙'], path: '/home', icon: '⭐' },
  { label: '미션', keywords: ['미션', 'mission', '목표', '주간', 'weekly'], path: '/home', icon: '🎯' },
  { label: '성취 뱃지', keywords: ['뱃지', '배지', 'badge', '성취', '업적', 'achievement', '연속', '스트릭', 'streak'], path: '/home', icon: '🏅' },
  { label: '이번 주 운동', keywords: ['이번주', '주간', '주', 'week', '달력', 'calendar'], path: '/home', icon: '📅' },

  // ─── 관리자 (관리자 권한 필요) ───
  { label: '관리자', keywords: ['관리자', 'admin', '어드민', '공지관리', '점검', '보안', 'AI', '관리'], path: '/admin', icon: '⚙️', adminOnly: true },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();

  // 공지사항 state
  const [popupNotice, setPopupNotice] = useState(null);
  const [unreadQueue, setUnreadQueue] = useState([]);
  const [homeSearch, setHomeSearch] = useState('');
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ironlog_search_history')) || []; } catch { return []; }
  });
  const [searchFocused, setSearchFocused] = useState(false);

  const addSearchHistory = (label) => {
    const updated = [label, ...searchHistory.filter(h => h !== label)].slice(0, 10);
    setSearchHistory(updated);
    localStorage.setItem('ironlog_search_history', JSON.stringify(updated));
  };

  const removeSearchHistory = (label) => {
    const updated = searchHistory.filter(h => h !== label);
    setSearchHistory(updated);
    localStorage.setItem('ironlog_search_history', JSON.stringify(updated));
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('ironlog_search_history');
  };

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();

    // 로그인 시 안 읽은 공지 전부 큐에 넣고 첫 번째부터 팝업
    const readList = getReadNotices();
    const unread = NOTICES.filter(n => !readList.includes(n.id));
    if (unread.length > 0) {
      setPopupNotice(unread[0]);
      markNoticeRead(unread[0].id);
      setUnreadQueue(unread.slice(1));
    }
  }, []);

  const handleOpenPopup = useCallback((notice) => {
    markNoticeRead(notice.id);
    setPopupNotice(notice);
  }, []);

  const handleClosePopup = useCallback(() => {
    // 큐에 남은 안 읽은 공지가 있으면 다음 공지 바로 표시
    setUnreadQueue(prev => {
      if (prev.length > 0) {
        const next = prev[0];
        markNoticeRead(next.id);
        setPopupNotice(next);
        return prev.slice(1);
      }
      setPopupNotice(null);
      return prev;
    });
  }, []);

  const handleGoNotice = useCallback(() => {
    setPopupNotice(null);
    navigate('/notice');
  }, [navigate]);

  const today = new Date().toISOString().split('T')[0];
  const todayWorkouts = workouts[today] || [];
  const weekDates = getWeekDates();
  const weekWorkoutDays = useMemo(() => weekDates.filter(d => workouts[d] && workouts[d].length > 0).length, [weekDates, workouts]);
  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);
  const latestInbody = records[0] || null;

  const loading = wLoading || iLoading;

  return (
    <div>
      {/* 오늘 날짜 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="56" height="56" viewBox="0 0 60 60" fill="none">
            <defs><linearGradient id="hDbGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffd700"/><stop offset="100%" stopColor="#ff6b1a"/></linearGradient></defs>
            <rect x="12" y="27" width="36" height="6" rx="3" fill="url(#hDbGrad)"/>
            <rect x="6" y="18" width="8" height="24" rx="3" fill="url(#hDbGrad)"/>
            <rect x="1" y="22" width="7" height="16" rx="2.5" fill="url(#hDbGrad)" opacity="0.7"/>
            <rect x="46" y="18" width="8" height="24" rx="3" fill="url(#hDbGrad)"/>
            <rect x="52" y="22" width="7" height="16" rx="2.5" fill="url(#hDbGrad)" opacity="0.7"/>
            <rect x="14" y="28" width="32" height="2" rx="1" fill="#fff" opacity="0.15"/>
          </svg>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: 5,
            lineHeight: 1,
            background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(255,107,26,0.3))',
          }}>
            STEEL BODY
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
      </div>

      {/* 검색 (가운데) */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <input
          type="text"
          className="input"
          placeholder="검색 (예: 운동, 인바디, 식단, 루틴)"
          value={homeSearch}
          onChange={(e) => setHomeSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          style={{ paddingLeft: 38, fontSize: 14 }}
        />
        <span style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          fontSize: 15, pointerEvents: 'none', opacity: 0.7,
        }}>🔍</span>

        {searchFocused && (homeSearch.trim() || searchHistory.length > 0) && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', maxHeight: 320, overflowY: 'auto',
            zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}>
            {homeSearch.trim() ? (() => {
              const admin = isAdmin();
              const results = SEARCH_ITEMS
                .filter(item => !item.adminOnly || admin)
                .filter(item => matchSearch(homeSearch, item));
              if (results.length === 0) return (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  일치하는 항목이 없어요
                </div>
              );
              return results.map((item, i) => (
                <div
                  key={item.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addSearchHistory(item.label);
                    setHomeSearch('');
                    setSearchFocused(false);
                    if (item.scroll) {
                      document.getElementById(item.scroll)?.scrollIntoView({ behavior: 'smooth' });
                    } else if (item.path) {
                      navigate(item.path, item.tab ? { state: { tab: item.tab } } : undefined);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', cursor: 'pointer',
                    borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.label}</span>
                </div>
              ));
            })() : (
              <>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px', borderBottom: '1px solid var(--border)',
                  fontSize: 11, color: 'var(--text-muted)',
                }}>
                  <span>최근 검색</span>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); clearSearchHistory(); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)',
                      fontSize: 11, cursor: 'pointer',
                    }}
                  >전체 삭제</button>
                </div>
                {searchHistory.map((label, i) => {
                  const item = SEARCH_ITEMS.find(s => s.label === label);
                  return (
                    <div
                      key={label}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 14px',
                        borderBottom: i < searchHistory.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (item) {
                            if (item.scroll) document.getElementById(item.scroll)?.scrollIntoView({ behavior: 'smooth' });
                            else if (item.path) navigate(item.path, item.tab ? { state: { tab: item.tab } } : undefined);
                          }
                          setSearchFocused(false);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}
                      >
                        <span style={{ fontSize: 14 }}>{item?.icon || '🕒'}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                      </div>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); removeSearchHistory(label); }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-muted)',
                          cursor: 'pointer', padding: 4, fontSize: 12,
                        }}
                      >✕</button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      ) : (
        <>
          {/* 공지사항 배너 */}
          <NoticeBanner onOpenPopup={handleOpenPopup} onGoNotice={handleGoNotice} />




          {/* 출시 기념 이벤트 (배너만) */}
          <div className="card clickable" onClick={() => navigate('/event')} style={{
            marginBottom: 16, padding: 16, textAlign: 'center',
            background: 'var(--home-event-bg)',
            border: '1px solid var(--home-event-border)',
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3,
              background: 'linear-gradient(135deg, #ffd700, #ff6b1a)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              marginBottom: 4,
            }}>GRAND LAUNCH EVENT</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {(() => {
                const launch = new Date('2026-04-22');
                const now = new Date();
                const diff = Math.ceil((launch - now) / (1000 * 60 * 60 * 24));
                return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-DAY!' : `D+${Math.abs(diff)}`;
              })()}
              {' · '}터치하여 이벤트 참여
            </div>
          </div>

          {/* 오늘의 요약 */}
          <div className="section-title">
            <div className="accent-bar" />
            오늘의 요약
          </div>

          {todayWorkouts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>💪</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>아직 오늘 운동 기록이 없어요</div>
              <button
                className="btn-primary"
                style={{ marginTop: 12, fontSize: 14, padding: '10px 20px', width: 'auto' }}
                onClick={() => navigate('/workout')}
              >
                운동 기록하기
              </button>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 8 }}>
                오늘 {todayWorkouts.length}개 운동 완료
              </div>
              {todayWorkouts.map((w) => (
                <div key={w.id} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '3px 0' }}>
                  {w.exercise} — {w.weight} · {w.sets}세트 · {w.reps}회
                </div>
              ))}
            </div>
          )}

          {/* 통계 박스 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            <StatBox number={`${weekWorkoutDays}/7`} label="이번 주" />
            <StatBox number={totalWorkouts} label="총 운동" />
            <StatBox number={latestInbody ? `${latestInbody.weight}` : '-'} label="최근 체중(kg)" />
          </div>

          {/* 레벨 시스템 */}
          <div className="section-title">
            <div className="accent-bar" />
            MY LEVEL
          </div>
          <LevelSystem totalWorkouts={totalWorkouts} totalInbody={records.length} />

          {/* 미션 */}
          <div className="section-title">
            <div className="accent-bar" />
            MISSIONS
          </div>
          <MissionSystem workouts={workouts} records={records} weekDates={weekDates} />

          {/* 이번 주 달력 */}
          <div className="section-title">
            <div className="accent-bar" />
            이번 주 운동
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
              {weekDates.map((d, i) => {
                const dayIdx = new Date(d).getDay();
                const hasWorkout = workouts[d] && workouts[d].length > 0;
                const isToday = d === today;
                return (
                  <div key={d} style={{ padding: '8px 0' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {DAYS[dayIdx]}
                    </div>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                      fontSize: 13,
                      fontWeight: isToday ? 700 : 400,
                      background: hasWorkout ? 'var(--accent)' : isToday ? 'var(--bg-tertiary)' : 'none',
                      color: hasWorkout ? '#000' : isToday ? 'var(--accent)' : 'var(--text-muted)',
                      border: isToday && !hasWorkout ? '1px solid var(--accent)' : 'none',
                    }}>
                      {d.slice(8)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 성취 뱃지 */}
          <div className="section-title">
            <div className="accent-bar" />
            성취 뱃지
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <Badges workouts={workouts} inbodyRecords={records} />
          </div>

          {/* 퀵 액션 */}
          <div className="section-title">
            <div className="accent-bar" />
            빠른 이동
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { icon: '🏋️', label: '기록', path: '/workout' },
              { icon: '📊', label: '인바디', path: '/inbody' },
              { icon: '📋', label: '루틴', path: '/routine' },
              { icon: '🏠', label: '홈트', path: '/homeworkout' },
              { icon: '📐', label: '측정', path: '/measure' },
              { icon: '📅', label: '히스토리', path: '/history' },
            ].map((q, i) => (
              <div key={q.label} className="card clickable" onClick={() => {
                if (q.scroll) {
                  document.getElementById(q.scroll)?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate(q.path);
                }
              }} style={{ textAlign: 'center', padding: '12px 6px' }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{q.icon}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, letterSpacing: 1 }}>{q.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 공지사항 팝업 */}
      <NoticePopup
        notice={popupNotice}
        onClose={handleClosePopup}
        onGoNotice={handleGoNotice}
        remaining={unreadQueue.length}
      />
    </div>
  );
}
