// 제보함이 쓰는 말과 갈래.
//
// **한 파일에 825줄이 있었다** — 자주 묻는 것 찾기 · 보내는 폼 · 내 제보 목록이
// 전부 한 덩어리였다. 8/26 에 리메이크하면서 들어가는 길(갈래를 밖에서 고르기)만
// 바꾸고 안쪽은 그대로 뒀는데, 그러다 보니 **목록 한 줄을 고치려고 폼 400줄을
// 지나쳐야** 했다. 2026-09-02 에 셋으로 나눴다 —
// 이 파일(말) · `reportView.js`(계산) · `ReportList.jsx`(목록).
//
// 여기 있는 것들은 **폼과 목록이 같이 본다.** 한쪽에만 두면 반드시 한쪽만 고쳐진다.

export const KINDS = [
  {
    key: 'bug', label: '버그', icon: 'bug', desc: '안 되거나 이상하게 나오는 것',
    titleLabel: '무슨 일이 있었나요',
    titleHint: '한 줄로 요약해 주세요',
    bodyLabel: '어떻게 하면 그렇게 되나요',
    bodyHint: '언제, 어디서, 무엇을 했더니 어떻게 됐는지 적어주시면 훨씬 빨리 찾습니다.\n예) 기록에서 무게를 넣고 저장했는데 히스토리에 안 보여요',
    minBody: 10, send: '버그 보내기', attachDefault: true,
    attachNote: '기기와 화면 정보가 있으면 재현이 훨씬 빠릅니다',
  },
  {
    key: 'ask', label: '문의', icon: 'chat', desc: '어떻게 쓰는지 모르겠는 것',
    titleLabel: '무엇이 궁금한가요',
    titleHint: '예) 기록한 운동을 나중에 고칠 수 있나요?',
    bodyLabel: '덧붙일 말 (없으면 비워두세요)',
    bodyHint: '더 설명할 게 있으면 적어주세요. 없으면 비워두셔도 됩니다.',
    minBody: 0, send: '문의 보내기', attachDefault: false,
    attachNote: '문의에는 보통 필요 없습니다',
  },
  {
    key: 'idea', label: '건의', icon: 'bulb', desc: '이렇게 됐으면 하는 것',
    titleLabel: '무엇이 있었으면 하나요',
    titleHint: '예) 루틴에 메모를 남기고 싶어요',
    bodyLabel: '왜 필요한가요',
    bodyHint: '어떤 상황에서 아쉬웠는지 적어주시면 판단이 쉽습니다.',
    minBody: 5, send: '건의 보내기', attachDefault: false,
    attachNote: '건의에는 보통 필요 없습니다',
  },
];

export const kindOf = key => KINDS.find(k => k.key === key) || KINDS[0];

// 버그 전용 — 어느 화면인지
// 8/25 에 늘어난 화면들(운동 검색 · 운동 알림)이 빠져 있었다. 없는 화면의 버그는
// 「그 밖에」로 오는데, 그러면 어느 화면인지를 물어본 뜻이 없어진다
export const SCREENS = ['홈', '기록', '인바디', '루틴', '기능성운동', '운동 검색', '측정', '히스토리', '운동 알림', '고객센터', '그 밖에'];

// 버그 전용 — 다시 해도 그런지. 한 번뿐이면 우선순위가 다르다
export const FREQ = [
  { key: 'always',    label: '매번 그래요' },
  { key: 'sometimes', label: '가끔 그래요' },
  { key: 'once',      label: '한 번만 그랬어요' },
];

// 건의 전용 — 지금은 어떻게 버티고 있는지. 대안이 있으면 급하지 않다
export const WORKAROUND = [
  { key: 'none',   label: '방법이 없어요' },
  { key: 'clumsy', label: '불편하게 돌려서 해요' },
  { key: 'okay',   label: '그냥 없어도 돼요' },
];

export const STATUS = {
  received: { label: '접수',     color: 'var(--info)',       dim: 'var(--info-dim)' },
  checking: { label: '확인중',   color: 'var(--warning)',    dim: 'var(--warning-dim)' },
  done:     { label: '처리완료', color: 'var(--success)',    dim: 'var(--success-dim)' },
  held:     { label: '보류',     color: 'var(--text-muted)', dim: 'var(--bg-tertiary)' },
};

// 서버가 주는 날짜는 ISO 문자열이다. 화면에는 날짜만 쓴다
export const dayOf = iso => (typeof iso === 'string' ? iso.slice(0, 10) : '');
