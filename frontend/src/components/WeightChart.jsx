import { lazy, Suspense } from 'react';

// 차트는 필요할 때 받아온다.
//
// recharts 는 이 앱에서 제일 무거운 덩어리다(gzip 110KB). 위에서 그냥 import 하면
// 히스토리·인바디 화면이 그 덩어리를 다 받을 때까지 아무것도 안 그린다 — 통계도 목록도
// 같이 기다린다. 화면을 먼저 띄우고 차트만 뒤늦게 채운다.
//
// 자리는 미리 잡아둔다. 안 그러면 차트가 도착하는 순간 아래 내용이 밀려 내려간다.
const Impl = lazy(() => import('./WeightChartImpl'));

const CHART_HEIGHT = 180;

function Placeholder() {
  return (
    <div style={{
      height: CHART_HEIGHT,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: 12, fontFamily: "'Barlow', sans-serif",
    }}>
      차트 불러오는 중…
    </div>
  );
}

export default function WeightChart(props) {
  // 기록이 두 개도 안 되면 차트를 그릴 일이 없다 — 무거운 덩어리도 받지 않는다
  if (!props.records || props.records.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13, fontFamily: "'Barlow', sans-serif" }}>
        인바디 기록이 2개 이상 있어야 차트가 표시돼요
      </div>
    );
  }
  return (
    <Suspense fallback={<Placeholder />}>
      <Impl {...props} />
    </Suspense>
  );
}
