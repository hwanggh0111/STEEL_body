import BodyMap from '../components/BodyMap';

// 몸 지도 — 제 화면.
//
// 처음에는 「몸」 탭 안쪽 갈래였다. 그런데 **지도는 몸 상태를 말하는 화면이 아니다** —
// 「오늘 뭘 하지」에 답하는 화면이다. 체지방이 어떻게 됐나(인바디 · 견주기)와 같은
// 방에 둘 것이 아니었다. 「오늘」 탭 첫 카드에서 이리로 들어온다.
//
// 화면은 얇다. 그리는 것은 전부 `components/BodyMap.jsx` 가 한다 — 홈의 요약 카드와
// 같은 계산(`data/bodyHeat.js`)을 보므로 둘이 다른 부위를 말할 일이 없다.
export default function BodyMapPage() {
  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        몸 지도
      </div>
      <BodyMap />
    </div>
  );
}
