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
  // 앞의 다섯과 **겹치는 운동이 하나도 없다.** 푸시업 · 스쿼트 · 플랭크 · 버피 ·
  // 점핑잭은 이미 다른 프로그램에 있다 — 시간만 바꿔 다시 깔면 프로그램을 하나 더
  // 둘 이유가 없다. 여기는 **물건을 들고 몸을 옮기는 것**만 담는다 (배낭 · 수건 · 계단).
  //
  // 뛰는 동작도 없다. 층간소음 때문에 밤에 못 하는 프로그램이 이미 둘(타바타 ·
  // 전신 초급)이라 이쪽은 조용한 것으로 채웠다. 앞 여섯은 무게를 들고 버티고,
  // 뒤 여섯으로 갈수록 짧고 빨라진다
  '기능성 훈련': [
    { name: '배낭 고블릿 스쿼트', duration: 40, rest: 20 },
    { name: '배낭 파머스 워크', duration: 40, rest: 20 },
    { name: '수건 로우 (문고리)', duration: 40, rest: 20 },
    { name: '배낭 오버헤드 프레스', duration: 40, rest: 20 },
    { name: '터키시 겟업 (배낭)', duration: 40, rest: 20 },
    { name: '베어 크롤', duration: 30, rest: 20 },
    { name: '크랩 워크', duration: 30, rest: 15 },
    { name: '배낭 런지 워크', duration: 30, rest: 15 },
    { name: '계단 오르내리기', duration: 30, rest: 15 },
    { name: '배낭 스러스터', duration: 20, rest: 10 },
    { name: '인치웜', duration: 20, rest: 10 },
    { name: '섀도 복싱', duration: 30, rest: 0 },
  ],
};

// 프로그램마다 한 줄로 무엇인지. 이름만 보고는 옆 프로그램과 뭐가 다른지 모른다 —
// 「기능성 훈련」과 「유산소 타바타」가 특히 그렇다.
// 없는 프로그램은 안 적어도 된다 (화면이 있는 것만 그린다)
export const PROGRAM_NOTES = {
  '기능성 훈련': [
    '앞 여섯은 무게를 들고 버티고, 뒤 여섯으로 갈수록 짧고 빨라집니다 — 근력에서 유산소로.',
    '배낭에 책 서너 권(약 5kg)이나 2L 물통 둘(약 4kg)을 넣어 씁니다. 어깨끈을 조여 등에 붙이세요.',
    '뛰는 동작이 없어 밤에도 할 수 있습니다. 베어 크롤 · 크랩 워크는 발을 끌지 말고 들어서 옮기세요.',
    '수건 로우는 수건을 문고리에 걸고 몸을 뒤로 눕혀 당깁니다. 계단이 없으면 의자 스텝업으로 대신하세요.',
  ],
  '유산소 타바타': [
    '처음부터 끝까지 20초씩 몰아칩니다. 근력 없이 숨만 차게 하는 쪽이에요.',
  ],
};
