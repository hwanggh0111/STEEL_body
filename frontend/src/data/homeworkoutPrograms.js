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
  // **추천 루틴의 「기능성(특수부대식)」과 같은 운동들이다** (`backend/src/routes/routines.js`).
  // 거기는 세트·횟수로 적어둔 목록이고, 여기는 그것을 **시간을 재는 한 판**으로 옮긴 것이다.
  // 그래서 이름을 그대로 쓴다 — 루틴에서 배운 동작을 홈트에서 그대로 돌린다.
  // `npm run check` 가 두 파일의 이름을 맞춰본다.
  //
  // 들고 걷는 것 → 버티는 것 → 서킷 → 숨차게, 순서로 놓았다.
  // 뒤 둘(하이니 · 버피)은 뛰는 동작이라 밤에는 빼라고 설명에 적어뒀다
  '기능성(특수부대식)': [
    { name: '배낭 파머스 워크', duration: 40, rest: 20 },
    { name: '오버헤드 배낭 워크', duration: 40, rest: 20 },
    { name: '배낭 안고 런지 워크', duration: 40, rest: 20 },
    { name: '데드행', duration: 30, rest: 20 },
    { name: '월싯', duration: 40, rest: 20 },
    { name: '플랭크', duration: 40, rest: 15 },
    { name: '할로우 홀드', duration: 30, rest: 15 },
    { name: '플랭크 어깨 터치', duration: 30, rest: 15 },
    { name: '배낭 스러스터', duration: 40, rest: 15 },
    { name: '마운틴 클라이머', duration: 40, rest: 10 },
    { name: '하이니 스프린트', duration: 20, rest: 10 },
    { name: '버피', duration: 20, rest: 0 },
  ],
};

// 프로그램마다 한 줄로 무엇인지. 이름만 보고는 옆 프로그램과 뭐가 다른지 모른다 —
// 「기능성(특수부대식)」과 「유산소 타바타」가 특히 그렇다.
// 없는 프로그램은 안 적어도 된다 (화면이 있는 것만 그린다)
export const PROGRAM_NOTES = {
  '기능성(특수부대식)': [
    '추천 루틴의 「기능성(특수부대식)」과 같은 운동을 시간 재는 한 판으로 옮긴 것입니다. 공식 프로그램은 아닙니다.',
    '들고 걷기 → 버티기 → 서킷 → 숨차게 순서예요. 배낭에 책 서너 권(약 5kg)이나 2L 물통 둘(약 4kg)을 넣어 씁니다.',
    '마지막 둘(하이니 스프린트 · 버피)은 뛰는 동작입니다. 밤이라면 이 둘을 빼고 마운틴 클라이머를 한 번 더 하세요.',
    '데드행은 문틀바를 잡고 매답니다. 문틀바가 없으면 수건 양끝을 잡고 팔을 편 채 버티세요.',
  ],
  '유산소 타바타': [
    '처음부터 끝까지 20초씩 몰아칩니다. 근력 없이 숨만 차게 하는 쪽이에요.',
  ],
};
