import React, { useState, useEffect, useCallback, useRef } from 'react';
import { addAdminNotice, getAllNotices, NOTICE_BADGE } from '../data/notices';
import { useLangStore } from '../store/langStore';
import { TEMPLATES, CATEGORY_KEYS, getAiRecommendations } from '../data/aiNoticeTemplates';
const SCHEDULE_KEY = 'ironlog_ai_notice_schedule';

function getSchedules() {
  try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY)) || []; } catch { return []; }
}
function saveSchedules(list) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(list));
}

// ─── 오늘 날짜 YYYY-MM-DD ───
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 컴포넌트 ───
export default function AiNoticeWriter() {
  const { lang } = useLangStore();
  const t = (ko, en) => (lang === 'ko' ? ko : en);

  // 템플릿 선택
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // 공지 작성 폼
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('공지');
  const [date, setDate] = useState(todayStr());

  // 스케줄
  const [schedules, setSchedules] = useState(getSchedules());
  const [scheduleDay, setScheduleDay] = useState('1');
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleContent, setScheduleContent] = useState('');
  const [scheduleType, setScheduleType] = useState('공지');

  // UI 상태
  const [activeTab, setActiveTab] = useState('template');
  const [preview, setPreview] = useState(null);
  const [toast, setToast] = useState('');
  const [recommendations] = useState(() => getAiRecommendations(lang));

  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2500);
  }, []);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // 템플릿 선택 시 자동 채우기
  const applyTemplate = (catKey, idx) => {
    const cat = TEMPLATES[catKey];
    const item = cat.items[idx];
    setSelectedCategory(catKey);
    setSelectedTemplate(idx);
    setTitle(item.title[lang] || item.title.ko);
    setContent(item.content[lang] || item.content.ko);
    setType(cat.type);
    setDate(todayStr());
  };

  // 추천 적용
  const applyRecommendation = (rec) => {
    setTitle(rec.title);
    setContent(rec.content);
    setType(rec.type);
    setDate(todayStr());
    setActiveTab('template');
    showToast(t('추천 공지가 적용되었습니다!', 'Recommendation applied!'));
  };

  // 공지 등록
  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      showToast(t('제목과 본문을 입력해주세요.', 'Please enter title and content.'));
      return;
    }
    const allNotices = getAllNotices();
    const maxId = allNotices.length > 0 ? Math.max(...allNotices.map((n) => n.id)) : 0;
    const newNotice = {
      id: maxId + 1,
      date,
      title: title.trim(),
      type,
      content: content.trim(),
    };
    addAdminNotice(newNotice);
    setPreview(newNotice);
    showToast(t('공지가 등록되었습니다!', 'Notice published!'));
    setTitle('');
    setContent('');
    setSelectedCategory('');
    setSelectedTemplate(null);
  };

  // 스케줄 추가
  const addSchedule = () => {
    if (!scheduleTitle.trim() || !scheduleContent.trim()) {
      showToast(t('스케줄 제목과 본문을 입력해주세요.', 'Please enter schedule title and content.'));
      return;
    }
    const dayNames = {
      ko: ['일', '월', '화', '수', '목', '금', '토'],
      en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    };
    const newSchedule = {
      id: Date.now(),
      dayOfWeek: parseInt(scheduleDay),
      dayLabel: dayNames[lang][parseInt(scheduleDay)],
      title: scheduleTitle.trim(),
      content: scheduleContent.trim(),
      type: scheduleType,
      createdAt: todayStr(),
    };
    const updated = [...schedules, newSchedule];
    setSchedules(updated);
    saveSchedules(updated);
    setScheduleTitle('');
    setScheduleContent('');
    showToast(t('스케줄이 등록되었습니다!', 'Schedule added!'));
  };

  const deleteSchedule = (id) => {
    const updated = schedules.filter((s) => s.id !== id);
    setSchedules(updated);
    saveSchedules(updated);
    showToast(t('스케줄이 삭제되었습니다.', 'Schedule deleted.'));
  };

  // 자동 스케줄 실행 (오늘 요일에 해당하는 스케줄 자동 공지)
  useEffect(() => {
    const today = new Date().getDay();
    const lastRun = localStorage.getItem('ironlog_schedule_last_run');
    const todayKey = todayStr();
    if (lastRun === todayKey) return;

    const todaySchedules = schedules.filter((s) => s.dayOfWeek === today);
    if (todaySchedules.length > 0) {
      const allNotices = getAllNotices();
      let maxId = allNotices.length > 0 ? Math.max(...allNotices.map((n) => n.id)) : 0;
      todaySchedules.forEach((s) => {
        maxId += 1;
        addAdminNotice({
          id: maxId,
          date: todayKey,
          title: s.title,
          type: s.type,
          content: s.content,
        });
      });
      localStorage.setItem('ironlog_schedule_last_run', todayKey);
    }
  }, [schedules]);

  // ─── 스타일 ───
  const styles = {
    container: {
      maxWidth: 900,
      margin: '0 auto',
      padding: '24px 16px',
      fontFamily: "'Barlow', 'Noto Sans KR', sans-serif",
    },
    header: {
      fontFamily: "'Bebas Neue', sans-serif",
      fontSize: 32,
      letterSpacing: 2,
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    subHeader: {
      color: 'var(--text-muted)',
      fontSize: 14,
      marginBottom: 24,
    },
    tabs: {
      display: 'flex',
      gap: 8,
      marginBottom: 24,
      flexWrap: 'wrap',
    },
    tab: (active) => ({
      padding: '10px 20px',
      borderRadius: 8,
      border: active ? '2px solid var(--accent)' : '2px solid var(--border)',
      background: active ? 'var(--accent)' : 'var(--bg-secondary)',
      color: active ? '#000' : 'var(--text-muted)',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 14,
      transition: 'all 0.2s',
      fontFamily: "'Barlow', sans-serif",
    }),
    catGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: 12,
      marginBottom: 20,
    },
    catCard: (active) => ({
      padding: '16px 12px',
      borderRadius: 12,
      border: active ? '2px solid var(--accent)' : '2px solid var(--border)',
      background: active ? 'rgba(var(--accent-rgb, 255,183,77), 0.1)' : 'var(--bg-secondary)',
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all 0.2s',
    }),
    catIcon: {
      fontSize: 28,
      display: 'block',
      marginBottom: 6,
    },
    catLabel: {
      fontSize: 13,
      fontWeight: 600,
    },
    templateList: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginBottom: 20,
    },
    templateItem: (active) => ({
      padding: '14px 16px',
      borderRadius: 10,
      border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
      background: active ? 'rgba(var(--accent-rgb, 255,183,77), 0.08)' : 'var(--bg-secondary)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      transition: 'all 0.15s',
    }),
    formGroup: {
      marginBottom: 16,
    },
    label: {
      display: 'block',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-muted)',
      marginBottom: 6,
      fontFamily: "'Barlow', sans-serif",
    },
    textarea: {
      width: '100%',
      minHeight: 160,
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      color: 'inherit',
      fontSize: 14,
      fontFamily: "'Barlow', 'Noto Sans KR', sans-serif",
      resize: 'vertical',
      boxSizing: 'border-box',
    },
    select: {
      padding: '10px 14px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      color: 'inherit',
      fontSize: 14,
      fontFamily: "'Barlow', sans-serif",
      cursor: 'pointer',
    },
    previewCard: {
      padding: 20,
      borderRadius: 14,
      border: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      marginTop: 16,
    },
    previewDate: {
      fontSize: 12,
      color: 'var(--text-muted)',
      marginBottom: 4,
    },
    previewTitle: {
      fontFamily: "'Bebas Neue', sans-serif",
      fontSize: 20,
      letterSpacing: 1,
      marginBottom: 8,
    },
    previewContent: {
      fontSize: 14,
      lineHeight: 1.7,
      whiteSpace: 'pre-wrap',
      color: 'var(--text-muted)',
    },
    recCard: {
      padding: '14px 16px',
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      cursor: 'pointer',
      transition: 'all 0.15s',
      marginBottom: 10,
    },
    recReason: {
      fontSize: 12,
      color: 'var(--text-muted)',
      marginTop: 4,
    },
    scheduleItem: {
      padding: '14px 16px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    toast: {
      position: 'fixed',
      bottom: 30,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--accent)',
      color: '#000',
      padding: '12px 28px',
      borderRadius: 10,
      fontWeight: 700,
      fontSize: 14,
      zIndex: 9999,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      fontFamily: "'Barlow', sans-serif",
    },
    aiTag: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: 'var(--accent)',
      color: '#000',
      padding: '2px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 700,
      marginLeft: 8,
      fontFamily: "'Bebas Neue', sans-serif",
      letterSpacing: 1,
    },
    badge: (type) => {
      const cls = NOTICE_BADGE[type] || 'badge';
      return {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        marginRight: 8,
      };
    },
    dayBadge: {
      display: 'inline-block',
      background: 'var(--accent)',
      color: '#000',
      padding: '2px 10px',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 700,
      marginRight: 8,
    },
  };

  const dayOptions = lang === 'ko'
    ? ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const typeOptions = ['공지', '업데이트', '신기능', '이벤트', '긴급공지'];

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <div style={styles.header}>
        <span role="img" aria-label="robot">🤖</span>
        AI NOTICE WRITER
        <span style={styles.aiTag}>AI POWERED</span>
      </div>
      <div style={styles.subHeader}>
        {t(
          'AI가 자동으로 공지사항을 작성하고 추천합니다.',
          'AI automatically writes and recommends notices.'
        )}
      </div>

      {/* 탭 */}
      <div style={styles.tabs}>
        {[
          { key: 'template', label: t('템플릿 작성', 'Templates'), icon: '📝' },
          { key: 'recommend', label: t('AI 추천', 'AI Suggest'), icon: '🤖' },
          { key: 'schedule', label: t('자동 스케줄', 'Auto Schedule'), icon: '📅' },
        ].map((tab) => (
          <button
            key={tab.key}
            style={styles.tab(activeTab === tab.key)}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── 탭: 템플릿 작성 ── */}
      {activeTab === 'template' && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, fontWeight: 700 }}>
            {t('1. 카테고리 선택', '1. Select Category')}
          </h3>
          <div style={styles.catGrid}>
            {CATEGORY_KEYS.map((key) => (
              <div
                key={key}
                style={styles.catCard(selectedCategory === key)}
                onClick={() => {
                  setSelectedCategory(key);
                  setSelectedTemplate(null);
                }}
              >
                <span style={styles.catIcon}>{TEMPLATES[key].icon}</span>
                <span style={styles.catLabel}>
                  {TEMPLATES[key].label[lang] || TEMPLATES[key].label.ko}
                </span>
              </div>
            ))}
          </div>

          {selectedCategory && (
            <>
              <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700 }}>
                {t('2. 템플릿 선택', '2. Select Template')}
              </h3>
              <div style={styles.templateList}>
                {TEMPLATES[selectedCategory].items.map((item, idx) => (
                  <div
                    key={idx}
                    style={styles.templateItem(selectedTemplate === idx)}
                    onClick={() => applyTemplate(selectedCategory, idx)}
                  >
                    <span style={{ fontSize: 20 }}>{TEMPLATES[selectedCategory].icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {item.title[lang] || item.title.ko}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700 }}>
            {t('3. 공지 작성', '3. Write Notice')}
          </h3>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={styles.label}>{t('분류', 'Type')}</label>
              <select
                className="input"
                style={styles.select}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {typeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={styles.label}>{t('날짜', 'Date')}</label>
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 14 }}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('제목', 'Title')}</label>
            <input
              className="input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('공지 제목을 입력하세요...', 'Enter notice title...')}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('본문', 'Content')}</label>
            <textarea
              className="input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('공지 본문을 입력하세요...', 'Enter notice content...')}
              style={styles.textarea}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={handleSubmit} style={{ flex: 1 }}>
              🤖 {t('공지 등록', 'Publish Notice')}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setTitle('');
                setContent('');
                setSelectedCategory('');
                setSelectedTemplate(null);
              }}
              style={{ flex: 0 }}
            >
              {t('초기화', 'Reset')}
            </button>
          </div>

          {/* 미리보기 */}
          {(title || content || preview) && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700 }}>
                {t('미리보기', 'Preview')}
              </h3>
              <div style={styles.previewCard}>
                <div style={styles.previewDate}>{date}</div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <span className={NOTICE_BADGE[type] || 'badge'} style={styles.badge(type)}>
                    {type}
                  </span>
                  <span style={styles.previewTitle}>{title || t('(제목 없음)', '(No title)')}</span>
                </div>
                <div style={styles.previewContent}>{content || t('(본문 없음)', '(No content)')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 탭: AI 추천 ── */}
      {activeTab === 'recommend' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
              {t('AI가 추천하는 공지', 'AI-Recommended Notices')}
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, marginTop: 0 }}>
            {t(
              '현재 날짜, 요일, 시즌을 기반으로 추천하는 공지입니다. 클릭하면 바로 작성할 수 있습니다.',
              'Notices recommended based on current date, day, and season. Click to apply.'
            )}
          </p>
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              style={styles.recCard}
              onClick={() => applyRecommendation(rec)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{rec.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{rec.title}</span>
              </div>
              <div style={styles.recReason}>
                {t('추천 사유', 'Reason')}: {rec.reason}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 탭: 자동 스케줄 ── */}
      {activeTab === 'schedule' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 22 }}>📅</span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
              {t('자동 반복 공지 스케줄', 'Auto Recurring Notice Schedule')}
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, marginTop: 0 }}>
            {t(
              '설정한 요일마다 자동으로 공지가 등록됩니다.',
              'Notices will be automatically posted on the selected day.'
            )}
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 140 }}>
              <label style={styles.label}>{t('반복 요일', 'Day of Week')}</label>
              <select
                className="input"
                style={styles.select}
                value={scheduleDay}
                onChange={(e) => setScheduleDay(e.target.value)}
              >
                {dayOptions.map((label, idx) => (
                  <option key={idx} value={idx}>{label}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 140 }}>
              <label style={styles.label}>{t('분류', 'Type')}</label>
              <select
                className="input"
                style={styles.select}
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
              >
                {typeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('제목', 'Title')}</label>
            <input
              className="input"
              type="text"
              value={scheduleTitle}
              onChange={(e) => setScheduleTitle(e.target.value)}
              placeholder={t('예: 이번 주도 화이팅! 운동 챌린지', 'e.g. Weekly Workout Challenge')}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('본문', 'Content')}</label>
            <textarea
              className="input"
              value={scheduleContent}
              onChange={(e) => setScheduleContent(e.target.value)}
              placeholder={t('자동으로 등록될 공지 본문...', 'Content for the auto-posted notice...')}
              style={{ ...styles.textarea, minHeight: 100 }}
            />
          </div>

          <button className="btn-primary" onClick={addSchedule} style={{ marginBottom: 24 }}>
            📅 {t('스케줄 등록', 'Add Schedule')}
          </button>

          {/* 스케줄 목록 */}
          <h4 style={{ marginBottom: 12, fontSize: 15, fontWeight: 700 }}>
            {t('등록된 스케줄', 'Registered Schedules')} ({schedules.length})
          </h4>
          {schedules.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {t('등록된 스케줄이 없습니다.', 'No schedules registered.')}
            </p>
          )}
          {schedules.map((s) => (
            <div key={s.id} style={styles.scheduleItem}>
              <div>
                <span style={styles.dayBadge}>
                  {dayOptions[s.dayOfWeek]}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {s.type} | {t('등록일', 'Created')}: {s.createdAt}
                </div>
              </div>
              <button
                className="btn-secondary"
                onClick={() => deleteSchedule(s.id)}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                {t('삭제', 'Delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 최근 등록 미리보기 */}
      {preview && (
        <div className="card" style={{ padding: 20, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              {t('최근 등록된 공지', 'Recently Published Notice')}
            </h4>
          </div>
          <div style={styles.previewCard}>
            <div style={styles.previewDate}>{preview.date}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <span className={NOTICE_BADGE[preview.type] || 'badge'} style={styles.badge(preview.type)}>
                {preview.type}
              </span>
              <span style={styles.previewTitle}>{preview.title}</span>
            </div>
            <div style={styles.previewContent}>{preview.content}</div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
