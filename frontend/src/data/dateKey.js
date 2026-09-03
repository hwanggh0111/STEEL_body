// 날짜 키는 반드시 로컬 기준으로 만든다.
//
// toISOString() 은 UTC 로 바꾼 뒤 자르기 때문에 KST(+9)에서는 새벽 0시~8시 59분 사이에
// 하루 전 날짜가 나온다. 기록은 WorkoutPage 가 로컬 날짜로 저장하는데 홈이 UTC 로 조회하면,
// 새벽에 남긴 운동이 홈에서 사라지고 주간 표도 하루씩 밀린다.
//
// 같은 헬퍼가 여러 곳에 따로 있었다. 새로 쓰는 곳은 여기를 쓴다.
export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
