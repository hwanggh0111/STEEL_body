// 홈트 프로그램 여섯. 화면(`pages/HomeworkoutPage.jsx`)과 검사(`scripts/check-data.cjs`)가
// 같이 본다 — 화면 안에 두면 검사가 읽으려고 react-router 까지 끌고 와야 한다.
//
// duration 은 운동하는 초, rest 는 그 다음 쉬는 초다. **마지막 운동의 rest 는 0** —
// 끝나고 쉴 필요가 없다 (화면도 마지막 뒤에는 휴식을 넣지 않는다).
export const PROGRAMS = {
  '전신 초급': [
    { name: '점핑잭', duration: 30, rest: 15 },
    { name: '스쿼트', duration: 30, rest: 15 },
    { name: '푸시업', duration: 30, rest: 15 },
    { name: '런지 (좌우)', duration: 30, rest: 15 },
    { name: '플랭크', duration: 30, rest: 15 },
    { name: '버피', duration: 20, rest: 20 },
    { name: '마운틴 클라이머', duration: 30, rest: 15 },
    { name: '슈퍼맨', duration: 30, rest: 0 },
  ],
  '상체 집중': [
    { name: '푸시업', duration: 30, rest: 15 },
    { name: '와이드 푸시업', duration: 30, rest: 15 },
    { name: '다이아몬드 푸시업', duration: 25, rest: 20 },
    { name: '딥스 (의자)', duration: 30, rest: 15 },
    { name: '파이크 푸시업', duration: 25, rest: 20 },
    { name: '플랭크 숄더탭', duration: 30, rest: 15 },
    { name: '인클라인 푸시업', duration: 30, rest: 15 },
    { name: '플랭크', duration: 40, rest: 0 },
  ],
  '하체 집중': [
    { name: '스쿼트', duration: 30, rest: 15 },
    { name: '와이드 스쿼트', duration: 30, rest: 15 },
    { name: '런지', duration: 30, rest: 15 },
    { name: '불가리안 스플릿 스쿼트', duration: 30, rest: 20 },
    { name: '힙쓰러스트', duration: 30, rest: 15 },
    { name: '카프레이즈', duration: 30, rest: 15 },
    { name: '점프 스쿼트', duration: 25, rest: 20 },
    { name: '월싯', duration: 40, rest: 0 },
  ],
  '코어 강화': [
    { name: '크런치', duration: 30, rest: 15 },
    { name: '레그레이즈', duration: 30, rest: 15 },
    { name: '플랭크', duration: 40, rest: 15 },
    { name: '사이드 플랭크 (좌)', duration: 25, rest: 10 },
    { name: '사이드 플랭크 (우)', duration: 25, rest: 15 },
    { name: '바이시클 크런치', duration: 30, rest: 15 },
    { name: '마운틴 클라이머', duration: 30, rest: 15 },
    { name: '데드버그', duration: 30, rest: 0 },
  ],
  '유산소 타바타': [
    { name: '점핑잭', duration: 20, rest: 10 },
    { name: '하이니', duration: 20, rest: 10 },
    { name: '버피', duration: 20, rest: 10 },
    { name: '마운틴 클라이머', duration: 20, rest: 10 },
    { name: '점프 스쿼트', duration: 20, rest: 10 },
    { name: '스케이터', duration: 20, rest: 10 },
    { name: '터크점프', duration: 20, rest: 10 },
    { name: '점핑 런지', duration: 20, rest: 0 },
  ],
  // 타바타와 같은 판을 한 번 더 깔지 않는다 — 타바타는 처음부터 끝까지 20초씩
  // 몰아치는 것이고, 이쪽은 **힘을 먼저 쓰고 뒤에서 숨을 몰아친다.**
  // 앞 여섯은 오래 버티며 힘을 쓰고(40초·긴 휴식), 뒤 여섯으로 갈수록 짧고 빨라진다
  '기능성 훈련': [
    { name: '푸시업', duration: 40, rest: 20 },
    { name: '스쿼트', duration: 40, rest: 20 },
    { name: '인버티드 로우 (식탁 아래)', duration: 40, rest: 20 },
    { name: '힙 브리지', duration: 40, rest: 20 },
    { name: '불가리안 스플릿 스쿼트 (좌우)', duration: 30, rest: 20 },
    { name: '플랭크', duration: 40, rest: 15 },
    { name: '할로우 홀드', duration: 30, rest: 15 },
    { name: '의자 스텝업', duration: 30, rest: 15 },
    { name: '마운틴 클라이머', duration: 30, rest: 15 },
    { name: '버피', duration: 20, rest: 10 },
    { name: '하이니', duration: 20, rest: 10 },
    { name: '점핑잭', duration: 30, rest: 0 },
  ],
};

// 프로그램마다 한 줄로 무엇인지. 이름만 보고는 옆 프로그램과 뭐가 다른지 모른다 —
// 「기능성 훈련」과 「유산소 타바타」가 특히 그렇다.
// 없는 프로그램은 안 적어도 된다 (화면이 있는 것만 그린다)
export const PROGRAM_NOTES = {
  '기능성 훈련': [
    '힘을 먼저 쓰고 뒤에서 숨을 몰아칩니다 — 앞 여섯은 근력(40초씩 오래), 뒤 여섯은 유산소예요.',
    '뒤쪽 셋(버피 · 하이니 · 점핑잭)은 뛰는 동작입니다. 밤이라면 이 셋을 빼고 마운틴 클라이머를 한 번 더 하세요.',
    '인버티드 로우는 식탁 아래에 누워 상판을 잡고 당깁니다. 식탁이 없으면 수건을 문고리에 걸고 당기세요.',
  ],
  '유산소 타바타': [
    '처음부터 끝까지 20초씩 몰아칩니다. 근력 없이 숨만 차게 하는 쪽이에요.',
  ],
};
