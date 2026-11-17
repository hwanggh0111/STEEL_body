import BodyMap from '../components/BodyMap';
import PartBalance from '../components/PartBalance';

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
      {/* **미는 것과 당기는 것** (2026-11-17, 시안 C). 지도 **아래**다 —
          지도는 「오늘 뭘 하지」에 답하고, 이 칸은 「요즘 치우쳤나」에 답한다.
          위에 두면 오늘 갈 곳을 고르는 길이 한 칸 멀어진다.
          셀 것이 없으면 이 칸은 아무것도 안 그린다(`PartBalance` 머리글) */}
      <PartBalance />
    </div>
  );
}
