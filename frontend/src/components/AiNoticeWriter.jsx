import React, { useState, useEffect, useCallback } from 'react';
import { addAdminNotice, getAllNotices, NOTICE_BADGE } from '../data/notices';
import { useLangStore } from '../store/langStore';

// ─── AI 공지 템플릿 ───
const TEMPLATES = {
  update: {
    label: { ko: '업데이트', en: 'Update' },
    icon: '🔄',
    type: '업데이트',
    items: [
      {
        title: { ko: '새로운 기능이 추가되었습니다', en: 'New Features Added' },
        content: {
          ko: '안녕하세요, STEEL BODY 팀입니다.\n\n이번 업데이트에서 새로운 기능이 추가되었습니다.\n\n■ 주요 변경사항\n• 기능 1: 설명\n• 기능 2: 설명\n\n더 나은 서비스를 위해 노력하겠습니다. 감사합니다!',
          en: 'Hello from the STEEL BODY team.\n\nNew features have been added in this update.\n\n■ Key Changes\n• Feature 1: Description\n• Feature 2: Description\n\nThank you for your continued support!',
        },
      },
      {
        title: { ko: 'v1.x 업데이트 안내', en: 'v1.x Update Notice' },
        content: {
          ko: 'STEEL BODY v1.x 업데이트가 완료되었습니다.\n\n■ 업데이트 내용\n• 성능 개선\n• UI/UX 개선\n• 버그 수정\n\n업데이트 후 문제가 있으시면 문의해주세요.',
          en: 'STEEL BODY v1.x update has been completed.\n\n■ Update Details\n• Performance improvements\n• UI/UX enhancements\n• Bug fixes\n\nPlease contact us if you experience any issues.',
        },
      },
      {
        title: { ko: '앱 최적화 업데이트', en: 'App Optimization Update' },
        content: {
          ko: '앱 성능 최적화 업데이트가 진행되었습니다.\n\n■ 개선 사항\n• 로딩 속도 개선\n• 메모리 사용량 최적화\n• 배터리 소모 감소\n\n쾌적한 이용 환경을 위해 최신 버전으로 업데이트해주세요.',
          en: 'An app performance optimization update has been applied.\n\n■ Improvements\n• Faster loading times\n• Optimized memory usage\n• Reduced battery consumption\n\nPlease update to the latest version for the best experience.',
        },
      },
    ],
  },
  maintenance: {
    label: { ko: '점검', en: 'Maintenance' },
    icon: '🔧',
    type: '공지',
    items: [
      {
        title: { ko: '서버 점검 안내', en: 'Server Maintenance Notice' },
        content: {
          ko: '안녕하세요, STEEL BODY 팀입니다.\n\n아래 일정으로 서버 점검이 진행됩니다.\n\n■ 점검 일정\n• 일시: YYYY년 MM월 DD일 HH:00 ~ HH:00\n• 소요 시간: 약 1시간\n\n점검 중에는 서비스 이용이 제한됩니다.\n불편을 드려 죄송합니다.',
          en: 'Hello from the STEEL BODY team.\n\nServer maintenance is scheduled as follows.\n\n■ Schedule\n• Date: YYYY-MM-DD HH:00 ~ HH:00\n• Duration: Approximately 1 hour\n\nServices will be limited during maintenance.\nWe apologize for the inconvenience.',
        },
      },
      {
        title: { ko: '긴급 점검 안내', en: 'Emergency Maintenance' },
        content: {
          ko: '긴급 서버 점검이 진행 중입니다.\n\n■ 사유: 서버 안정화 작업\n■ 예상 소요 시간: 약 30분 ~ 1시간\n\n빠르게 복구하겠습니다. 양해 부탁드립니다.',
          en: 'Emergency server maintenance is in progress.\n\n■ Reason: Server stabilization\n■ Estimated Duration: 30 min ~ 1 hour\n\nWe will restore services as soon as possible. Thank you for your patience.',
        },
      },
    ],
  },
  event: {
    label: { ko: '이벤트', en: 'Event' },
    icon: '🎉',
    type: '이벤트',
    items: [
      {
        title: { ko: '출시 기념 이벤트', en: 'Launch Celebration Event' },
        content: {
          ko: 'STEEL BODY 출시를 기념하여 특별 이벤트를 진행합니다!\n\n■ 이벤트 내용\n• 기간: MM월 DD일 ~ MM월 DD일\n• 참여 방법: 운동 기록 3회 이상 등록\n• 보상: 특별 뱃지 지급\n\n많은 참여 부탁드립니다!',
          en: 'We are hosting a special event to celebrate the launch of STEEL BODY!\n\n■ Event Details\n• Period: MM/DD ~ MM/DD\n• How to join: Log 3+ workouts\n• Reward: Special badge\n\nJoin now!',
        },
      },
      {
        title: { ko: '챌린지 이벤트 시작', en: 'Challenge Event Starts' },
        content: {
          ko: '새로운 운동 챌린지가 시작됩니다!\n\n■ 챌린지 정보\n• 이름: OO 챌린지\n• 기간: 2주\n• 목표: 매일 운동 기록하기\n• 보상: 챌린지 완료 뱃지\n\n함께 도전해보세요!',
          en: 'A new workout challenge begins!\n\n■ Challenge Info\n• Name: OO Challenge\n• Duration: 2 weeks\n• Goal: Log workouts daily\n• Reward: Challenge completion badge\n\nJoin the challenge!',
        },
      },
      {
        title: { ko: '시즌 특별 이벤트', en: 'Seasonal Special Event' },
        content: {
          ko: '시즌 특별 이벤트를 진행합니다!\n\n■ 이벤트 내용\n• 기간: MM월 DD일 ~ MM월 DD일\n• 미션 완료 시 특별 보상 지급\n• 랭킹 상위 유저 추가 보상\n\n지금 바로 참여하세요!',
          en: 'A seasonal special event is here!\n\n■ Event Details\n• Period: MM/DD ~ MM/DD\n• Complete missions for special rewards\n• Top ranked users get bonus rewards\n\nJoin now!',
        },
      },
    ],
  },
  info: {
    label: { ko: '안내', en: 'Info' },
    icon: '📢',
    type: '공지',
    items: [
      {
        title: { ko: '이용약관 변경 안내', en: 'Terms of Service Update' },
        content: {
          ko: '이용약관이 아래와 같이 변경됩니다.\n\n■ 변경 일자: YYYY년 MM월 DD일\n■ 주요 변경 사항\n• 항목 1: 변경 내용\n• 항목 2: 변경 내용\n\n자세한 내용은 이용약관 페이지를 확인해주세요.',
          en: 'Our Terms of Service have been updated.\n\n■ Effective Date: YYYY-MM-DD\n■ Key Changes\n• Item 1: Change details\n• Item 2: Change details\n\nPlease review the full Terms of Service page for details.',
        },
      },
      {
        title: { ko: '개인정보처리방침 변경 안내', en: 'Privacy Policy Update' },
        content: {
          ko: '개인정보처리방침이 변경됩니다.\n\n■ 시행일: YYYY년 MM월 DD일\n■ 변경 사항\n• 수집 항목 변경\n• 보관 기간 조정\n\n자세한 내용은 개인정보처리방침 페이지를 참고해주세요.',
          en: 'Our Privacy Policy has been updated.\n\n■ Effective Date: YYYY-MM-DD\n■ Changes\n• Updated data collection items\n• Adjusted retention periods\n\nPlease review the full Privacy Policy page for details.',
        },
      },
    ],
  },
  bugfix: {
    label: { ko: '버그수정', en: 'Bug Fix' },
    icon: '🐛',
    type: '업데이트',
    items: [
      {
        title: { ko: '오류 수정 완료', en: 'Bug Fix Complete' },
        content: {
          ko: '아래 오류가 수정되었습니다.\n\n■ 수정된 버그\n• [기능명] 오류 현상 설명 → 정상 동작하도록 수정\n• [기능명] 오류 현상 설명 → 정상 동작하도록 수정\n\n이용에 불편을 드려 죄송합니다.',
          en: 'The following bugs have been fixed.\n\n■ Fixed Bugs\n• [Feature] Bug description → Fixed\n• [Feature] Bug description → Fixed\n\nWe apologize for the inconvenience.',
        },
      },
      {
        title: { ko: '로그인 문제 해결', en: 'Login Issue Resolved' },
        content: {
          ko: '로그인 관련 문제가 해결되었습니다.\n\n■ 해결된 문제\n• 소셜 로그인 실패 → 정상화\n• 자동 로그인 미동작 → 수정 완료\n\n다시 한번 불편을 드려 죄송합니다.',
          en: 'Login issues have been resolved.\n\n■ Fixed Issues\n• Social login failure → Resolved\n• Auto-login not working → Fixed\n\nWe apologize for the inconvenience.',
        },
      },
      {
        title: { ko: '데이터 동기화 오류 수정', en: 'Data Sync Error Fixed' },
        content: {
          ko: '데이터 동기화 관련 오류가 수정되었습니다.\n\n■ 수정 내용\n• 운동 기록 동기화 지연 → 실시간 반영\n• 인바디 데이터 누락 → 복구 완료\n\n안정적인 서비스를 위해 노력하겠습니다.',
          en: 'Data synchronization errors have been fixed.\n\n■ Fix Details\n• Workout log sync delay → Now real-time\n• InBody data loss → Recovered\n\nWe will continue working to improve stability.',
        },
      },
    ],
  },
};

const CATEGORY_KEYS = Object.keys(TEMPLATES);

// ─── AI 공지 추천 로직 ───
function getAiRecommendations(lang) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const recommendations = [];

  const dayNames = {
    ko: ['일', '월', '화', '수', '목', '금', '토'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  };

  // 요일 기반
  if (dayOfWeek === 1) {
    recommendations.push({
      icon: '💪',
      title: lang === 'ko' ? '이번 주도 화이팅! 운동 챌린지' : 'New Week, New Challenge!',
      reason: lang === 'ko' ? `${dayNames.ko[dayOfWeek]}요일 - 새로운 한 주의 시작` : `${dayNames.en[dayOfWeek]} - Start of a new week`,
      content: lang === 'ko'
        ? '새로운 한 주가 시작되었습니다!\n\n이번 주 목표를 세우고, 매일 운동 기록을 남겨보세요.\n꾸준함이 최고의 근육입니다! 💪'
        : 'A new week begins!\n\nSet your goals and log your workouts every day.\nConsistency is the best muscle! 💪',
      type: '공지',
    });
  }
  if (dayOfWeek === 5) {
    recommendations.push({
      icon: '🏆',
      title: lang === 'ko' ? '이번 주 운동 리포트 확인하세요!' : 'Check Your Weekly Report!',
      reason: lang === 'ko' ? `${dayNames.ko[dayOfWeek]}요일 - 한 주 마무리` : `${dayNames.en[dayOfWeek]} - End of the week`,
      content: lang === 'ko'
        ? '이번 주도 수고하셨습니다!\n\n대시보드에서 이번 주 운동 기록을 확인해보세요.\n다음 주에도 함께 달려요! 🏃'
        : 'Great work this week!\n\nCheck your weekly workout stats on the dashboard.\nSee you next week! 🏃',
      type: '공지',
    });
  }
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    recommendations.push({
      icon: '🔥',
      title: lang === 'ko' ? '주말 특별 운동 루틴 추천' : 'Weekend Special Workout',
      reason: lang === 'ko' ? '주말 - 여유 있는 운동 시간' : 'Weekend - Extra workout time',
      content: lang === 'ko'
        ? '주말에는 평소 못했던 운동에 도전해보세요!\n\n■ 추천 루틴\n• 전신 운동 1시간\n• 유산소 30분\n• 스트레칭 15분\n\n주말도 알차게 보내세요! 🔥'
        : 'Try new workouts on the weekend!\n\n■ Recommended Routine\n• Full body workout 1hr\n• Cardio 30min\n• Stretching 15min\n\nMake the most of your weekend! 🔥',
      type: '공지',
    });
  }

  // 시즌/월 기반
  if (month === 1) {
    recommendations.push({
      icon: '🎯',
      title: lang === 'ko' ? '새해 운동 목표를 세워보세요!' : 'Set Your New Year Fitness Goals!',
      reason: lang === 'ko' ? '1월 - 새해 시작' : 'January - New year begins',
      content: lang === 'ko'
        ? '새해 복 많이 받으세요! 🎊\n\n올해의 운동 목표를 세워볼까요?\n\n■ 추천 목표\n• 주 3회 이상 운동\n• 체중 목표 설정\n• 새로운 운동 도전\n\n올해는 꼭 목표를 달성합시다!'
        : 'Happy New Year! 🎊\n\nLet\'s set your fitness goals for this year!\n\n■ Suggested Goals\n• Work out 3+ times per week\n• Set a weight target\n• Try new exercises\n\nLet\'s make this year count!',
      type: '이벤트',
    });
  }
  if (month === 12) {
    recommendations.push({
      icon: '📊',
      title: lang === 'ko' ? '올해 운동 정리 리포트' : 'Year-End Fitness Report',
      reason: lang === 'ko' ? '12월 - 연말 정리' : 'December - Year-end summary',
      content: lang === 'ko'
        ? '올 한해도 수고하셨습니다! 🎄\n\n올해 운동 기록을 돌아봅시다.\n\n■ 확인해보세요\n• 총 운동 일수\n• 최고 기록 갱신\n• 체중 변화 추이\n\n내년에도 함께 해요!'
        : 'Great job this year! 🎄\n\nLet\'s review your annual workout data.\n\n■ Check Out\n• Total workout days\n• Personal records\n• Weight trends\n\nSee you next year!',
      type: '공지',
    });
  }
  if (month >= 3 && month <= 5) {
    recommendations.push({
      icon: '🌸',
      title: lang === 'ko' ? '봄맞이 다이어트 챌린지' : 'Spring Diet Challenge',
      reason: lang === 'ko' ? '봄 시즌 - 여름 준비' : 'Spring - Get ready for summer',
      content: lang === 'ko'
        ? '봄이 왔습니다! 여름을 대비해 다이어트를 시작해볼까요?\n\n■ 챌린지\n• 기간: 4주\n• 주 4회 이상 운동\n• 식단 기록 병행\n\n함께 여름 바디를 만들어요! 🌸'
        : 'Spring is here! Time to prepare for summer!\n\n■ Challenge\n• Duration: 4 weeks\n• Work out 4+ times per week\n• Track your meals\n\nLet\'s build that summer body! 🌸',
      type: '이벤트',
    });
  }
  if (month >= 6 && month <= 8) {
    recommendations.push({
      icon: '☀️',
      title: lang === 'ko' ? '여름 운동 시 수분 섭취 안내' : 'Summer Hydration Reminder',
      reason: lang === 'ko' ? '여름 시즌 - 탈수 주의' : 'Summer - Stay hydrated',
      content: lang === 'ko'
        ? '무더운 여름, 운동 시 수분 섭취에 유의하세요!\n\n■ 수분 섭취 팁\n• 운동 전 300~500ml\n• 운동 중 15분마다 150~200ml\n• 운동 후 체중 감소량 x 1.5배 보충\n\n건강하게 운동하세요! ☀️'
        : 'Stay hydrated during summer workouts!\n\n■ Hydration Tips\n• Before workout: 300~500ml\n• During: 150~200ml every 15min\n• After: 1.5x weight lost\n\nStay healthy! ☀️',
      type: '공지',
    });
  }
  if (month >= 9 && month <= 11) {
    recommendations.push({
      icon: '🍂',
      title: lang === 'ko' ? '가을 벌크업 시즌 시작!' : 'Fall Bulk Season Begins!',
      reason: lang === 'ko' ? '가을 시즌 - 벌크업 시즌' : 'Fall - Bulking season',
      content: lang === 'ko'
        ? '선선한 가을, 벌크업의 계절입니다!\n\n■ 벌크업 팁\n• 단백질 섭취 늘리기\n• 중량 점진적 증가\n• 충분한 휴식\n\n근육 성장의 골든 타임을 놓치지 마세요! 🍂'
        : 'Cool autumn air, perfect for bulking!\n\n■ Bulking Tips\n• Increase protein intake\n• Progressive overload\n• Get enough rest\n\nDon\'t miss the golden time for muscle growth! 🍂',
      type: '공지',
    });
  }

  // 특정 날짜
  if (month === 1 && date === 1) {
    recommendations.push({
      icon: '🎆',
      title: lang === 'ko' ? '새해 첫날 운동 이벤트!' : 'New Year\'s Day Workout Event!',
      reason: lang === 'ko' ? '1월 1일 - 새해 첫날' : 'Jan 1 - New Year\'s Day',
      content: lang === 'ko'
        ? '새해 첫날 운동을 기록하면 특별 뱃지를 드립니다!\n\n새해 첫 운동으로 올해를 힘차게 시작하세요! 🎆'
        : 'Log a workout on New Year\'s Day for a special badge!\n\nStart the year strong! 🎆',
      type: '이벤트',
    });
  }

  // 기본 추천 (항상 포함)
  recommendations.push({
    icon: '📣',
    title: lang === 'ko' ? '정기 업데이트 안내' : 'Regular Update Notice',
    reason: lang === 'ko' ? '주기적 공지 추천' : 'Periodic notice suggestion',
    content: lang === 'ko'
      ? 'STEEL BODY가 꾸준히 발전하고 있습니다.\n\n최근 업데이트 내용을 확인해주세요!\n더 좋은 서비스를 위해 노력하겠습니다.'
      : 'STEEL BODY keeps getting better.\n\nCheck out our recent updates!\nWe are committed to improving your experience.',
    type: '업데이트',
  });

  return recommendations;
}

// ─── 스케줄 저장소 키 ───
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

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

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
