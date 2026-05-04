export const TEMPLATES = {
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

export const CATEGORY_KEYS = Object.keys(TEMPLATES);

export function getAiRecommendations(lang) {
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
