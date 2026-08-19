import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from './Toast';
import { usePlateStore } from '../store/plateStore';
import { useHoldRepeat } from './useHoldRepeat';
import {
  PLATE_RULE, DODGE, GROUND, PLATES, drawPlate,
  EXPECTED_PER_PLATE, EXPECTED_PER_PLATE_COMMON,
  JACKPOT_VALUE, groundLife, plateValueText, RAINBOW_STOPS,
  plateWeight, PLATE_WEIGHT_TOTAL, PLATE_WEIGHT_TOTAL_PROD, HAS_DEV_WEIGHTS,
} from '../data/plateData';

// 원판 이름 — name 이 있으면 그걸, 없으면 무게로 부른다
const plateName = (p) => p.name || `${p.kg}kg`;

// 확률 표기. 무한 0.00199%, 울트라 무한 0.000498% 라 소수 첫째 자리로 자르면
// 둘 다 "0.0%" 가 되어 확률이 0인 것처럼 보인다.
// 1% 아래는 유효숫자 3자리로 찍어 아무리 작아도 실제 값이 드러나게 한다.
const fmtPct = (v) => (v >= 1 ? v.toFixed(1) : String(Number(v.toPrecision(3))));

// 위에서 떨어지는 원판을 피하고, 바닥에 쌓인 원판을 주워 모으는 게임.
// 피하는 것만으로는 아무것도 안 들어온다 — 주운 원판의 값(1~9,999,990)만 점수가 된다.
// 주우려면 낙하 구간으로 다시 들어가야 해서 "안전하게 피하기"와 "욕심내서 줍기"가
// 상충한다. 모은 원판으로 파칭코 티켓을 산다.
//
// 60fps 로 도는 부분은 전부 ref 안에서 처리하고 캔버스에 직접 그린다.
// 프레임마다 setState 하면 React 가 초당 60번 리렌더해서 폰에서 끊긴다.

const T = {
  title: '원판 피하기',
  sub: '떨어지는 원판을 피하고, 바닥에 남은 원판을 주우세요',
  start: '시작',
  retry: '다시',
  playing: '피하는 중…',
  score: '이번 판',
  best: '최고',
  wallet: '보유 원판',
  today: '오늘 남은 판',
  noPlays: '오늘 판을 다 썼어요',
  shop: '티켓 교환',
  buy1: '1장',
  buy10: '10장',
  buyMax: '최대',
  needPlates: '원판이 모자라요',
  full: '티켓이 가득 찼어요',
  hint: '드래그하거나 ← → 로 움직이세요 · 바닥 원판을 밟으면 줍습니다',
  hitTitle: '맞았다!',
  revive: '부활',
  giveUp: '여기서 끝내기',
  reviveDesc: (score, left) =>
    `부활하면 지금까지 모은 🥏 ${score}개를 그대로 들고 이어서 합니다. 남은 부활 ${left}번.`,
  reviveLeft: '부활',
  revivedNote: '부활',
  lethalTag: '즉사',
  lethalNote: '울트라 무한에 맞았습니다 — 부활 없이 그대로 끝납니다',
  unlimitedTag: '무한 티켓',
  unlimitedToast: '∞ 무한 티켓 획득 — 이제 티켓이 닳지 않습니다',
  unlimitedGot: '∞ 무한 티켓을 얻었습니다. 파칭코와 사다리에서 티켓이 영원히 닳지 않습니다.',
  unlimitedOwned: '∞ 무한 티켓 보유 중 — 티켓이 닳지 않습니다',
  rates: '원판표',
  ratesTitle: '원판표',
  ratesDesc: '떨어지는 원판의 종류와 등장 확률입니다. 무거울수록 크고 빠른 대신 주웠을 때 많이 줍니다.',
  appear: '등장',
  onPick: '주우면',
  dodgeReward: '피하기만 하면',
  avgPick: '주울 때 평균 (∞ 제외)',
  avgWithLegend: '∞ 포함',
  avgProdNote: '운영 확률 기준',
  exchange: '교환 비율',
  perDay: '하루 판 수',
  close: '닫기',
};

// canPlay=false 면 도전을 막고 blockedReason 을 대신 띄운다.
// ticketRoom = 보유 상한까지 더 받을 수 있는 티켓 수. 상한을 넘겨 사면
// 파칭코 쪽 available 계산에서 잘려 원판만 사라지므로 교환 자체를 막는다.
export default function PlateDodge({ canPlay = true, blockedReason = '', ticketRoom = Infinity }) {
  const {
    plates, best, day, unlimited,
    startRun, finishRun, buyTickets, rollDay, grantUnlimited,
  } = usePlateStore();

  const [phase, setPhase] = useState('idle');   // idle | playing | over
  const [score, setScore] = useState(0);
  const [last, setLast] = useState(null);       // 방금 판 결과 요약
  const [showShop, setShowShop] = useState(false);
  const [showRates, setShowRates] = useState(false);
  // 남은 부활은 gameRef 안에 있어 리렌더를 일으키지 않는다 — 화면 표시용으로만 따로 둔다
  const [revivesLeft, setRevivesLeft] = useState(PLATE_RULE.revives);
  const [qty, setQty] = useState(1);            // 교환창에서 고른 장수

  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  // 배경 그라디언트 캐시 — 높이에만 의존하는데 프레임마다 새로 만들고 있었다.
  // 60fps 면 초당 60개를 만들어 버리는 셈이라, 크기가 바뀔 때만 다시 만든다.
  const bgRef = useRef(null);
  const rafRef = useRef(0);
  const gameRef = useRef(null);

  // 진행 중인 판을 언마운트 때 정산하려면 최신 phase 가 필요하다 (cleanup 은 옛 값을 본다)
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  // 터치가 캔버스에서 시작한 드래그인지 (게임판 밖 스크롤과 구분)
  const draggingRef = useRef(false);

  // 앱을 켜 둔 채 자정을 넘기면 "오늘 남은 판"이 어제 값으로 굳는다.
  // 그게 0이면 시작 버튼이 잠겨서 startRun(→rollDay)이 아예 안 불리고,
  // 새로고침하기 전까지 오늘 판을 한 번도 못 돌린다. 그래서 화면이 돌아올 때마다 확인한다.
  useEffect(() => {
    rollDay();
    const onWake = () => { if (!document.hidden) rollDay(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [rollDay]);

  // 이 판을 이미 정산했는가. 정산 경로가 셋(죽음·이탈·페이지 종료)이라 플래그로 막는다.
  const settledRef = useRef(false);

  // 판이 끝나기 전에 화면을 벗어나면 그때까지 번 원판을 넣어준다.
  // 판 수는 시작할 때 이미 깎았으므로, 정산하지 않으면 하루치 기회만 날리는 셈이 된다.
  // 죽으나 나가나 결과가 같아지므로 이걸로 이득 보는 방법은 없다.
  // 부활을 고르는 중(revive)에 나가는 경우도 아직 정산 전이라 같이 넣는다.
  const settleRun = useCallback(() => {
    if (settledRef.current) return;
    const p = phaseRef.current;
    const g = gameRef.current;
    if (!g || (p !== 'playing' && p !== 'revive')) return;
    settledRef.current = true;
    finishRun(g.raw);
  }, [finishRun]);

  // 이탈 경로가 둘이다.
  //   라우팅으로 나가기 → 언마운트 cleanup
  //   새로고침 / 탭 닫기 / 브라우저 종료 → pagehide
  // 언마운트만 받으면 새로고침에서 판 수만 깎이고 번 원판이 통째로 사라진다.
  // beforeunload 대신 pagehide 를 쓴다 — 모바일 사파리에서도 뜨고 bfcache 진입에도 뜬다.
  useEffect(() => {
    window.addEventListener('pagehide', settleRun);
    return () => {
      window.removeEventListener('pagehide', settleRun);
      settleRun();
    };
  }, [settleRun]);

  // ── 캔버스 크기: 컨테이너 폭에 맞추고 DPR 보정 ──
  const fitCanvas = useCallback(() => {
    const cv = canvasRef.current, box = boxRef.current;
    if (!cv || !box) return;
    const w = box.clientWidth;
    const h = Math.round(w * DODGE.aspect);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);   // 3배까지 가면 폰에서 무겁다
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }, []);

  // ── 그리기 ──
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const w = cv.clientWidth, h = cv.clientHeight;
    const g = gameRef.current;

    // 바닥 — 그라디언트는 높이가 바뀔 때만 다시 만든다 (bgRef 주석 참고)
    if (bgRef.current?.h !== h) {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#14080c');
      bg.addColorStop(0.5, '#0c0c12');
      bg.addColorStop(1, '#090909');
      bgRef.current = { h, grad: bg };
    }
    ctx.fillStyle = bgRef.current.grad;
    ctx.fillRect(0, 0, w, h);

    // 바닥 선
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h * DODGE.playerY + w * DODGE.playerR);
    ctx.lineTo(w, h * DODGE.playerY + w * DODGE.playerR);
    ctx.stroke();

    if (!g) return;

    // 무지개 원판(울트라 무한)만의 채우기 — 단색 대신 원뿔 그라디언트가 천천히 돈다.
    // ctx.translate 로 원판 중심이 원점이 된 뒤에 불러야 색이 제자리에 앉는다.
    // createConicGradient 가 없는 브라우저에서는 조용히 단색으로 떨어진다.
    const fillFor = (spec) => {
      if (!spec.rainbow || !ctx.createConicGradient) return spec.color;
      const gd = ctx.createConicGradient(g.elapsed / 350, 0, 0);
      RAINBOW_STOPS.forEach((c, i) => gd.addColorStop(i / (RAINBOW_STOPS.length - 1), c));
      return gd;
    };

    // 바닥에 떨어진 원판 — 납작하게 눕혀 그리고, 사라지기 직전엔 깜빡인다
    for (const q of g.ground) {
      const left = groundLife(q.spec) - q.age;
      const blink = left < GROUND.fadeMs
        ? 0.25 + 0.55 * Math.abs(Math.sin(q.age / 90))
        : 0.85;
      const x = q.x * w, y = GROUND.y * h, r = q.spec.r * w;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(x, y);
      ctx.scale(1, 0.42);                // 눕혀서 바닥에 놓인 느낌
      ctx.shadowColor = q.spec.ring;
      // 잭팟은 멀리서도 보여야 주우러 갈지 판단할 시간이 생긴다
      ctx.shadowBlur = q.spec.value >= JACKPOT_VALUE ? 30 : 16;
      ctx.fillStyle = fillFor(q.spec);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = q.spec.ring;
      ctx.lineWidth = Math.max(2, r * 0.2);
      ctx.stroke();
      ctx.restore();
    }

    // 떨어지는 원판
    for (const p of g.plates) {
      const x = p.x * w, y = p.y * h, r = p.spec.r * w;
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = p.spec.ring;
      // 즉사 원판은 멀리서부터 눈에 띄어야 한다 — 다른 원판보다 훨씬 세게 빛낸다
      ctx.shadowBlur = p.spec.lethal ? 26 : 12;
      ctx.fillStyle = fillFor(p.spec);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = p.spec.ring;
      ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.stroke();
      // 즉사 원판에는 붉은 테를 하나 더 둘러 깜빡인다.
      // 흰색 몸통만으로는 "제일 좋은 것"으로만 보여서, 달려들다 판이 끝난다.
      // (가운데 구멍을 뚫는 destination-out 보다 먼저 그려야 지워지지 않는다)
      if (p.spec.lethal) {
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(g.elapsed / 100);
        ctx.strokeStyle = '#ff2d2d';
        ctx.lineWidth = Math.max(2, r * 0.14);
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // 가운데 구멍
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 플레이어 (역기 든 사람).
    // 발을 축으로 진행 방향으로 살짝 기울여 어디로 가는 중인지 눈에 보이게 한다.
    const px = g.player.x * w, py = h * DODGE.playerY, pr = w * DODGE.playerR;
    const invincible = g.elapsed < g.safeUntil;
    const lean = Math.max(-1, Math.min(1, (g.player.vx || 0) / DODGE.maxSpeed)) * DODGE.tilt;

    ctx.save();
    ctx.translate(px, py + pr);          // 발 위치로 원점을 옮기고
    ctx.rotate(lean);                    // 그 축으로 기운다
    ctx.globalAlpha = invincible ? 0.45 + 0.35 * Math.sin(g.elapsed / 70) : 1;
    ctx.strokeStyle = '#ff6b1a';
    ctx.lineWidth = Math.max(2.5, pr * 0.22);
    ctx.lineCap = 'round';
    // 바
    ctx.beginPath();
    ctx.moveTo(-pr, -pr * 1.5);
    ctx.lineTo(pr, -pr * 1.5);
    ctx.stroke();
    // 몸
    ctx.beginPath();
    ctx.moveTo(0, -pr * 1.5);
    ctx.lineTo(0, -pr * 0.4);
    ctx.stroke();
    // 다리
    ctx.beginPath();
    ctx.moveTo(0, -pr * 0.4);
    ctx.lineTo(-pr * 0.55, 0);
    ctx.moveTo(0, -pr * 0.4);
    ctx.lineTo(pr * 0.55, 0);
    ctx.stroke();
    // 머리
    ctx.fillStyle = '#ff6b1a';
    ctx.beginPath();
    ctx.arc(0, -pr * 1.95, pr * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, []);

  // 창 크기가 그대로여도 컨테이너 폭은 바뀔 수 있다 (스크롤바 등장, 레이아웃 변화, 화면 회전).
  // window resize 만 보면 그런 경우에 캔버스가 옛 크기로 남아 그림이 어긋난다.
  //
  // draw 를 의존성에 넣으므로 반드시 draw 선언 뒤에 와야 한다 —
  // 의존성 배열은 렌더 중에 평가되어서, 위에 두면 초기화 전 접근으로 컴포넌트가 통째로 죽는다.
  useEffect(() => {
    fitCanvas();
    draw();
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => { fitCanvas(); draw(); });
    ro.observe(box);
    return () => ro.disconnect();
  }, [fitCanvas, draw]);

  // ── 한 판 정산 ──
  // 루프 안(부활 없이 죽음)과 버튼(포기) 양쪽에서 부른다.
  // 루프 effect 의 의존성에 들어가므로 반드시 그 위에서 선언해야 한다.
  // lethal = 울트라 무한에 맞아 끝난 판. 부활이 남아 있었는데도 끝나므로
  // 결과 화면에 이유를 적어줘야 한다 (안 그러면 부활 버튼이 안 뜬 게 버그로 보인다).
  const endRun = useCallback((g, lethal = false) => {
    // 여기서 정산했다고 표시해 둔다. setPhase('over') 는 다음 렌더에나 반영되므로
    // 그 사이에 pagehide 가 뜨면 phaseRef 는 아직 'playing' 이라 두 번 들어온다.
    settledRef.current = true;
    const result = finishRun(g.raw);
    setLast({
      raw: g.raw, dodged: g.dodged, picked: g.picked,
      pickedBy: { ...g.pickedBy },   // 다음 판이 같은 객체를 덮어쓰지 않게 복사
      revivedCount: PLATE_RULE.revives - g.revives,   // 이 판에 몇 번 부활했는지
      lethal,
      gotUnlimited: !!g.gotUnlimited,   // 이 판에서 무한 티켓을 얻었는가
      ...result,
    });
    setPhase('over');
    if (result.added > 0) toast(`원판 +${result.added}`);
  }, [finishRun]);

  // 부활 — 화면의 원판을 치우고 무적을 걸어 이어서 한다
  const revive = () => {
    const g = gameRef.current;
    if (!g || g.revives <= 0) return;
    g.revives -= 1;
    setRevivesLeft(g.revives);

    // 멈춰 있는 동안 키 리스너가 떨어져 있어서, 그 사이 손을 뗐다면 keyup 을 못 받았다.
    // 눌린 채로 남으면 매 프레임 그쪽으로 목표가 밀려 벽에 박히고,
    // 포인터로 움직여도 다음 프레임에 도로 끌려가 조작이 안 먹는 것처럼 보인다.
    g.keys = { left: false, right: false };
    // 죽기 전 목표도 버린다 — 안 그러면 부활하자마자 옛 목표로 혼자 미끄러진다
    g.player.target = g.player.x;
    g.player.vx = 0;

    // 맞은 그 원판이 그대로 남아 있으면 부활하자마자 다시 맞는다
    g.plates = [];
    g.safeUntil = g.elapsed + DODGE.reviveGraceMs;
    // 다음 원판까지 숨 돌릴 틈
    g.nextSpawn = Math.max(g.nextSpawn, DODGE.reviveGraceMs * 0.6);
    setPhase('playing');
  };

  const giveUp = () => {
    const g = gameRef.current;
    if (g) endRun(g);
  };

  // ── 한 판 시작 ──
  const start = () => {
    if (!canPlay) return;
    // 판 수는 시작할 때 깎는다. 끝날 때 깎으면 지기 직전에 새로고침해서 무한히 돌릴 수 있다.
    if (!startRun()) { toast(T.noPlays, 'error'); return; }
    settledRef.current = false;   // 새 판이므로 정산 플래그를 되돌린다
    setShowShop(false);           // 열린 창이 남아 게임을 가리지 않게
    setShowRates(false);
    gameRef.current = {
      player: { x: 0.5, target: 0.5, vx: 0 },
      keys: { left: false, right: false },
      plates: [],
      ground: [],      // 바닥에 떨어져 주울 수 있는 원판
      dodged: 0,
      picked: 0,
      pickedBy: {},    // kg → 주운 개수. 뭘 주워서 이 점수가 났는지 결과창에 보여준다
      revives: PLATE_RULE.revives,
      // 무적이 끝나는 시각(elapsed 기준). 시작 직후와 부활 직후 두 번 걸린다.
      // graceMs 와 직접 비교하면 부활에는 무적을 줄 수 없다.
      safeUntil: DODGE.graceMs,
      raw: 0,          // 이번 판에 번 원판
      elapsed: 0,
      nextSpawn: 420,
      last: performance.now(),
    };
    setScore(0);
    setLast(null);
    setRevivesLeft(PLATE_RULE.revives);
    setPhase('playing');
  };

  // ── 루프 ──
  useEffect(() => {
    if (phase !== 'playing') return;

    const step = (now) => {
      const g = gameRef.current;
      if (!g) return;
      const dt = Math.min(now - g.last, 50);   // 탭 전환 후 큰 점프 방지
      g.last = now;
      g.elapsed += dt;

      // ── 이동 ──
      const sec = dt / 1000;
      const clampX = (v) => Math.max(DODGE.playerR, Math.min(1 - DODGE.playerR, v));

      // 키를 누르고 있는 동안은 일정 속도로 목표를 민다 (OS 키 반복에 의존하지 않게)
      const dir = (g.keys.right ? 1 : 0) - (g.keys.left ? 1 : 0);
      if (dir !== 0) g.player.target = clampX(g.player.target + dir * DODGE.keySpeed * sec);

      // 프레임 시간에 무관한 감쇠. dt 가 흔들려도 같은 거리를 따라간다.
      const follow = 1 - Math.exp(-DODGE.followK * sec);
      let move = (g.player.target - g.player.x) * follow;
      const maxStep = DODGE.maxSpeed * sec;
      if (move > maxStep) move = maxStep;
      else if (move < -maxStep) move = -maxStep;

      const prevX = g.player.x;
      g.player.x += move;
      if (Math.abs(g.player.target - g.player.x) < DODGE.snap) g.player.x = g.player.target;
      g.player.vx = sec > 0 ? (g.player.x - prevX) / sec : 0;

      // 생성
      g.nextSpawn -= dt;
      if (g.nextSpawn <= 0) {
        const spec = drawPlate();
        g.plates.push({ spec, x: spec.r + Math.random() * (1 - spec.r * 2), y: -spec.r * DODGE.aspect });
        const interval = Math.max(
          DODGE.spawnMin,
          DODGE.spawnBase - g.dodged * DODGE.spawnPerDodge
        );
        g.nextSpawn = interval * (0.75 + Math.random() * 0.5);
      }

      // 낙하 + 판정
      const speed = Math.min(DODGE.fallMax, DODGE.fallBase + g.dodged * DODGE.fallPerDodge);
      const pr = DODGE.playerR;
      let hit = false;
      // 무엇에 맞았는지도 들고 있어야 한다 — 울트라 무한(lethal)은 부활을 무시한다
      let hitLethal = false;

      for (let i = g.plates.length - 1; i >= 0; i--) {
        const p = g.plates[i];
        p.y += speed * p.spec.speed * (dt / 1000);

        // 충돌 (원-원). x 는 너비 비율, y 는 높이 비율이라 y 차이를 aspect 로 환산한다.
        if (!hit && g.elapsed >= g.safeUntil) {
          const dx = p.x - g.player.x;
          const dy = (p.y - DODGE.playerY) * DODGE.aspect;
          const rr = p.spec.r + pr * 0.75;
          if (dx * dx + dy * dy < rr * rr) {
            hit = true;
            hitLethal = !!p.spec.lethal;
          }
        }

        // 바닥에 닿으면 피한 것 — 점수는 없다. 원판만 바닥에 남겨 둔다.
        // dodged 는 계속 센다: 난이도(낙하 속도·생성 간격)와 결과창 표시에 쓴다.
        if (p.y >= GROUND.y) {
          g.plates.splice(i, 1);
          g.dodged += 1;
          g.ground.push({ spec: p.spec, x: p.x, age: 0 });
          if (g.ground.length > GROUND.max) {
            // 앞에서 그냥 밀어내면 900짜리 잭팟이 뒤에 쌓인 1짜리들에 밀려 사라진다.
            // 값이 가장 낮은 것 중 가장 오래된 걸 치운다 (배열이 착지 순서라 앞쪽이 오래된 것).
            let worst = 0;
            for (let k = 1; k < g.ground.length; k++) {
              if (g.ground[k].spec.value < g.ground[worst].spec.value) worst = k;
            }
            g.ground.splice(worst, 1);
          }
        }
      }

      // 바닥 원판: 수명 + 줍기
      for (let i = g.ground.length - 1; i >= 0; i--) {
        const q = g.ground[i];
        q.age += dt;
        if (q.age >= groundLife(q.spec)) { g.ground.splice(i, 1); continue; }

        const dx = q.x - g.player.x;
        const dy = (GROUND.y - DODGE.playerY) * DODGE.aspect;
        const rr = q.spec.r + pr * GROUND.grab;
        if (dx * dx + dy * dy < rr * rr) {
          g.ground.splice(i, 1);
          g.picked += 1;
          g.pickedBy[q.spec.kg] = (g.pickedBy[q.spec.kg] || 0) + 1;
          g.raw += q.spec.value;
          setScore(g.raw);
          // 무한 티켓은 줍는 즉시 확정한다 — 판이 끝날 때까지 미루면
          // 이 판을 정산 못 하고 나갔을 때 평생 한 번을 날린다.
          if (q.spec.unlimited && grantUnlimited()) {
            g.gotUnlimited = true;
            toast(T.unlimitedToast);
          }
        }
      }

      draw();

      if (hit) {
        // 부활이 남아 있으면 정산하지 않고 멈춰 세운다 — 여기서 쓸지 말지 고른다.
        // 루프는 phase 가 'playing' 일 때만 도므로 이 순간 게임이 멎는다.
        // 단 울트라 무한(lethal)에 맞으면 목숨이 남아 있어도 그대로 끝난다.
        if (!hitLethal && g.revives > 0) { setPhase('revive'); return; }
        endRun(g, hitLethal);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    gameRef.current.last = performance.now();
    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      // 루프가 멈추면 키 상태도 버린다. 멈춰 있는 동안 뗀 키는 keyup 이 안 오므로
      // 눌린 채로 남아 다음에 이어 할 때 그 방향으로 계속 끌려간다.
      const g = gameRef.current;
      if (g) g.keys = { left: false, right: false };
    };
  }, [phase, draw, endRun]);

  // ── 조작 ──
  const moveTo = (clientX) => {
    const cv = canvasRef.current, g = gameRef.current;
    if (!cv || !g) return;
    const rect = cv.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    g.player.target = Math.max(DODGE.playerR, Math.min(1 - DODGE.playerR, x));
  };

  // 플레이 중에는 창 전체에서 포인터를 따라간다.
  // 캔버스에서만 받으면 커서가 판 밖으로 나가는 순간 추적이 끊겨 캐릭터가 그 자리에 멈춘다
  // (마우스를 누르지 않으면 포인터 캡처도 안 잡히므로 더 자주 끊긴다).
  // 판 밖 좌표는 moveTo 가 양 끝으로 잘라주므로 가장자리에 붙는다.
  //
  // 단, 터치는 캔버스에서 시작한 드래그만 따라간다. 무조건 받으면 게임판 밖을
  // 스크롤하려고 쓸어올릴 때 캐릭터가 같이 끌려간다. 마우스는 누르지 않고 움직이는 게
  // 정상 조작이므로 그대로 따라간다.
  useEffect(() => {
    if (phase !== 'playing') return;
    const onMove = (e) => {
      if (e.pointerType === 'touch' && !draggingRef.current) return;
      moveTo(e.clientX);
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    // 누르고 있는 동안 계속 움직이도록 상태만 켜고 끈다.
    // keydown 마다 좌표를 옮기면 OS 의 키 반복 속도에 따라 이동 속도가 달라진다.
    const set = (e, down) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') g.keys.left = down;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') g.keys.right = down;
      else return;
      e.preventDefault();
    };
    const onDown = (e) => set(e, true);
    const onUp = (e) => set(e, false);
    // 창을 벗어나면 키가 눌린 채로 남아 계속 미끄러진다
    const onBlur = () => { const g = gameRef.current; if (g) g.keys = { left: false, right: false }; };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [phase]);

  // ── 교환 ──
  // 지갑과 보유 상한 중 더 빡빡한 쪽에 맞춘다
  const canAfford = Math.floor(plates / PLATE_RULE.perTicket);
  const affordable = Math.max(0, Math.min(canAfford, ticketRoom));
  const ticketFull = canAfford > 0 && affordable === 0;   // 원판은 있는데 티켓이 꽉 참
  // 판이 도는 중에는 창을 못 연다 — 열어도 게임은 뒤에서 계속 돌아 가려진 채로 죽는다.
  // 부활 선택 중에도 막는다. 판이 아직 안 끝나서 결과가 확정되지 않았다.
  // 교환창뿐 아니라 원판표도 같다. 모달이 화면을 덮어도 rAF 루프는 phase 가
  // 'playing' 인 한 계속 돌고, pointermove 리스너가 window 에 붙어 있어
  // 가려진 채로 캐릭터가 움직이다 죽는다.
  const inRun = phase === 'playing' || phase === 'revive';
  const canShop = affordable > 0 && !inRun;

  // 원판이 줄면(교환하거나 판이 끝나면) 고른 수량이 살 수 있는 양을 넘지 않게 맞춘다
  useEffect(() => {
    setQty(q => Math.max(1, Math.min(q, affordable || 1)));
  }, [affordable]);

  // − / + 는 꾹 누르고 있으면 계속 오르내린다. 한계에 닿으면 false 로 멈춘다.
  // 원판을 많이 모은 뒤에는 살 수 있는 장수가 수십에 이르러 한 번씩 눌러선 못 맞춘다.
  const holdStep = useHoldRepeat((step) => {
    const next = qty + step;
    if (next < 1 || next > affordable) return false;
    setQty(next);
    return true;
  });

  const buy = (n) => {
    const got = buyTickets(n);
    if (got > 0) toast(`🎫 티켓 ${got}장 구입 — 원판 ${got * PLATE_RULE.perTicket}개 사용`);
    else toast(T.needPlates, 'error');
    return got;
  };

  const remainingPlays = Math.max(0, PLATE_RULE.dailyPlays - day.plays);

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 'var(--radius)',
          background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 11,
          letterSpacing: 1.5, color: 'var(--accent)',
        }}>
          🥏 {T.title}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>{T.wallet}</div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, lineHeight: 1,
              color: plates > 0 ? 'var(--accent)' : 'var(--text-muted)',
            }}>
              🥏 {plates.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>{T.best}</div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, lineHeight: 1,
              color: 'var(--success)',
            }}>
              {best.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 게임판 */}
      <div ref={boxRef} style={{ position: 'relative', maxWidth: 420, margin: '0 auto 10px' }}>
        <canvas
          ref={canvasRef}
          /* 이동 추적은 window 에서 한다 (위 effect). 여기서는 누른 자리로 즉시 옮기는 것만 —
             터치는 손가락을 대는 순간 그 위치로 가야 하고, 그 전에는 pointermove 가 없다. */
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            draggingRef.current = true;   // 여기서 시작한 드래그만 터치로 인정한다
            moveTo(e.clientX);
          }}
          style={{
            display: 'block', width: '100%',
            borderRadius: 'var(--radius)',
            border: `1px solid ${(phase === 'over' || phase === 'revive') ? 'var(--danger)' : 'var(--border)'}`,
            touchAction: 'none',        // 드래그로 화면이 스크롤되지 않게
            cursor: phase === 'playing' ? 'none' : 'default',
            transition: 'border-color 200ms ease',
          }}
        />

        {/* 진행 중 점수 */}
        {phase === 'playing' && (
          <div style={{
            position: 'absolute', top: 8, left: 0, right: 0,
            textAlign: 'center', pointerEvents: 'none',
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 26,
            color: 'var(--accent)', textShadow: '0 0 12px rgba(255,107,26,0.6)',
          }}>
            🥏 {score.toLocaleString()}
            {revivesLeft > 0 && (
              <span style={{ fontSize: 13, marginLeft: 8, opacity: 0.85 }}>
                ❤️{revivesLeft > 1 ? `×${revivesLeft}` : ''}
              </span>
            )}
          </div>
        )}

        {/* 시작 / 결과 오버레이 */}
        {phase !== 'playing' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'rgba(0,0,0,0.55)', borderRadius: 'var(--radius)',
            padding: 16, textAlign: 'center',
          }}>
            {phase === 'over' && last && (
              <>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, lineHeight: 1,
                  color: 'var(--accent)',
                }}>
                  🥏 {last.raw.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  피함 {last.dodged} · 주움 {last.picked}
                  {last.revivedCount > 0 && (
                    <span style={{ color: 'var(--danger)' }}> · ❤️ {T.revivedNote} {last.revivedCount}</span>
                  )}
                </div>

                {/* 이 판에서 무한 티켓을 얻었으면 그게 결과의 전부다 */}
                {last.gotUnlimited && (
                  <div style={{
                    fontSize: 12, fontWeight: 700, maxWidth: 250,
                    padding: '8px 10px', borderRadius: 'var(--radius)',
                    background: 'linear-gradient(90deg,#ff3b3b,#ff8a00,#ffe600,#3bff6e,#00e5ff,#4d5bff,#c14dff)',
                    color: '#000',
                  }}>
                    {T.unlimitedGot}
                  </div>
                )}

                {/* 부활이 남았는데도 끝난 경우 — 이유를 안 적으면 버그로 보인다 */}
                {last.lethal && (
                  <div style={{
                    fontSize: 11, color: 'var(--danger)', maxWidth: 240,
                    padding: '5px 9px', borderRadius: 'var(--radius)',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--danger)',
                  }}>
                    ☠️ {T.lethalNote}
                  </div>
                )}

                {/* 무엇을 주워서 이 점수가 났는지 — 무거운 원판일수록 값이 크다는 걸 여기서 배운다.
                    실제로 주운 종류만 나오므로 최대 PLATES 종류 수만큼이다. */}
                {last.picked > 0 && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 4,
                    justifyContent: 'center', maxWidth: 240,
                  }}>
                    {PLATES.filter(p => last.pickedBy?.[p.kg] > 0).map(p => (
                      <span key={p.kg} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 6px', borderRadius: 'var(--radius)',
                        background: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${p.ring}66`,
                        fontSize: 10, color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: p.color, border: `1px solid ${p.ring}`,
                        }} />
                        {plateName(p)} ×{last.pickedBy[p.kg]}
                        <span style={{ color: 'var(--accent)' }}>
                          +{plateValueText(p, last.pickedBy[p.kg])}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  원판 {last.added}개 획득 · 오늘 {last.remaining}판 남음
                </div>
              </>
            )}
            {phase === 'idle' && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 240 }}>
                {T.sub}
              </div>
            )}
            {!canPlay && blockedReason && (
              <div style={{ fontSize: 11, color: 'var(--danger)', maxWidth: 240 }}>
                {blockedReason}
              </div>
            )}

            {/* 부활 — 판이 끝난 게 아니라 멈춰 있는 상태. 여기서만 다른 버튼이 뜬다.
                이어서 하면 지금까지 번 원판을 그대로 들고 가고, 포기하면 그 자리에서 정산한다. */}
            {phase === 'revive' ? (
              <>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, lineHeight: 1,
                  color: 'var(--danger)',
                }}>
                  {T.hitTitle}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 240 }}>
                  {T.reviveDesc(score, revivesLeft)}
                </div>
                <button className="btn-primary" onClick={revive} style={{ minWidth: 130 }}>
                  ❤️ {T.revive}
                </button>
                <button className="btn-secondary" onClick={giveUp} style={{ minWidth: 130 }}>
                  {T.giveUp}
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-primary"
                  onClick={start}
                  disabled={!canPlay || remainingPlays <= 0}
                  style={{ minWidth: 130, opacity: (!canPlay || remainingPlays <= 0) ? 0.5 : 1 }}
                >
                  {remainingPlays <= 0 ? T.noPlays : (phase === 'over' ? T.retry : T.start)}
                </button>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{T.hint}</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 오늘 남은 판 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 11, color: 'var(--text-muted)', marginBottom: 4,
      }}>
        <span>{T.today}</span>
        <span style={{ color: remainingPlays > 0 ? 'var(--text-secondary)' : 'var(--danger)' }}>
          {remainingPlays} / {PLATE_RULE.dailyPlays}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          width: `${(remainingPlays / PLATE_RULE.dailyPlays) * 100}%`, height: '100%',
          background: 'var(--accent)', borderRadius: 3, transition: 'width 300ms ease',
        }} />
      </div>

      {/* 교환창 열기 */}
      <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowShop(true)}
          disabled={!canShop}
          style={{
            width: '100%',
            background: canShop ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
            border: `1px solid ${canShop ? 'var(--border-accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            color: canShop ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 13, letterSpacing: 1.5,
            padding: '10px 0',
            cursor: canShop ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          🎫 {T.shop}
          <span style={{ fontSize: 11, opacity: 0.75, letterSpacing: 0 }}>
            {affordable > 0
              ? `${affordable}장 교환 가능`
              : unlimited
                ? T.unlimitedOwned   // 살 이유가 없다. "가득 찼다"고 하면 오해한다
                : (ticketFull ? T.full : `원판 ${PLATE_RULE.perTicket}개부터`)}
          </span>
        </button>

        {/* 원판표 — 파칭코 확률표와 같은 역할.
            판이 도는 중에는 교환창과 똑같이 막는다 (위 inRun 주석 참고) */}
        <button
          onClick={() => setShowRates(true)}
          disabled={inRun}
          style={{
            marginTop: 8, width: '100%',
            background: 'var(--bg-tertiary)',
            border: `1px solid ${inRun ? 'var(--border)' : 'var(--border-hover)'}`,
            borderRadius: 'var(--radius)',
            color: inRun ? 'var(--text-muted)' : 'var(--text-secondary)',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 13, letterSpacing: 1.5,
            padding: '9px 0', cursor: inRun ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          📊 {T.rates}
        </button>
      </div>

      {/* 원판표 */}
      {showRates && (
        <div
          onClick={() => setShowRates(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99998, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              maxWidth: 360, width: '100%',
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            }}
          >
            <h3 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 20, letterSpacing: 2,
              color: 'var(--text-primary)', marginBottom: 4,
            }}>
              📊 {T.ratesTitle}
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              {T.ratesDesc}
            </p>

            {/* 개발 빌드에서만. 운영 빌드에서는 HAS_DEV_WEIGHTS 가 false 라 통째로 사라진다 */}
            {HAS_DEV_WEIGHTS && (
              <div style={{
                marginBottom: 14, padding: '8px 10px',
                borderRadius: 'var(--radius)',
                background: 'rgba(255,193,7,0.10)',
                border: '1px solid var(--warning)',
                fontSize: 11, color: 'var(--warning)', lineHeight: 1.6,
              }}>
                ⚠️ 개발 빌드입니다. 아래 확률은 테스트하려고 부풀려 놓은 값이라
                실제와 전혀 다릅니다. 각 줄의 <b>운영 N%</b> 가 진짜 확률입니다.
                아래 평균값은 언제나 운영 기준으로 계산합니다.
              </div>
            )}

            {PLATES.map(p => {
              // 지금 빌드에서 실제로 적용되는 확률 (개발이면 부풀린 값)
              const pct = (plateWeight(p) / PLATE_WEIGHT_TOTAL) * 100;
              // 운영이라면 몇 %인지 — 개발 빌드에서만 같이 보여준다
              const prodPct = (p.weight / PLATE_WEIGHT_TOTAL_PROD) * 100;
              const boosted = HAS_DEV_WEIGHTS && p.devWeight != null && p.devWeight !== p.weight;
              return (
                <div key={p.kg} style={{ marginBottom: 10 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 12, marginBottom: 4,
                  }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      color: 'var(--text-primary)', fontWeight: 600,
                    }}>
                      {/* 실제 게임에 나오는 색 그대로 — 글자 설명보다 이게 빠르다 */}
                      <span style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: p.color, border: `2px solid ${p.ring}`,
                        boxShadow: p.value >= JACKPOT_VALUE ? `0 0 8px ${p.ring}` : 'none',
                      }} />
                      {plateName(p)}
                      {/* 즉사 원판은 보상만 보고 달려들면 안 되므로 여기서 미리 경고한다 */}
                      {p.lethal && (
                        <span style={{
                          padding: '1px 5px', borderRadius: 'var(--radius)',
                          background: 'var(--danger)', color: '#fff',
                          fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                        }}>
                          ☠️ {T.lethalTag}
                        </span>
                      )}
                      {/* 이건 "값이 크다"가 아니라 규칙이 바뀌는 등급이라 따로 알린다 */}
                      {p.unlimited && (
                        <span style={{
                          padding: '1px 5px', borderRadius: 'var(--radius)',
                          background: 'linear-gradient(90deg,#ff3b3b,#ffe600,#00e5ff,#c14dff)',
                          color: '#000', fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                        }}>
                          ∞ {T.unlimitedTag}
                        </span>
                      )}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {fmtPct(pct)}%
                      {/* 개발 빌드에서 부풀린 등급은 진짜 확률을 옆에 붙인다.
                          안 그러면 테스트용 6.6%를 실제 확률로 오해한다. */}
                      {boosted && (
                        <span style={{ color: 'var(--warning)' }}> (운영 {fmtPct(prodPct)}%)</span>
                      )}
                      {' · '}{T.onPick}{' '}
                      <span style={{ color: 'var(--accent)' }}>+{plateValueText(p)}</span>
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                    {/* 무한 원판은 막대가 0.01% 라 아예 안 보인다. 줄이 비어 보이지 않게
                        최소 폭만 준다 — 숫자는 위에 정확히 적혀 있다. */}
                    <div style={{
                      width: `${Math.max(pct, 0.8)}%`, height: '100%',
                      background: p.ring, borderRadius: 2,
                    }} />
                  </div>
                </div>
              );
            })}

            <div style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 'var(--radius)',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.9,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{T.dodgeReward}</span>
                <span style={{ color: 'var(--text-muted)' }}>🥏 0</span>
              </div>
              {/* 울트라 무한(4년 반에 한 번, 값 999만)이 산술 평균의 61%를 차지한다.
                  그 값만 띄우면 매 판 그만큼 받는 것처럼 읽히므로 ∞ 제외를 기본으로 둔다 */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{T.avgPick}</span>
                <span style={{ color: 'var(--success)' }}>
                  🥏 +{EXPECTED_PER_PLATE_COMMON.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {T.avgWithLegend}
                  {HAS_DEV_WEIGHTS && (
                    <span style={{ color: 'var(--warning)', fontSize: 10 }}> · {T.avgProdNote}</span>
                  )}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  🥏 +{EXPECTED_PER_PLATE.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{T.exchange}</span>
                <span>🥏 {PLATE_RULE.perTicket} → 🎫 1</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{T.perDay}</span>
                <span>{PLATE_RULE.dailyPlays.toLocaleString()}</span>
              </div>
            </div>

            <button
              className="btn-secondary"
              style={{ width: '100%', marginTop: 14 }}
              onClick={() => setShowRates(false)}
            >
              {T.close}
            </button>
          </div>
        </div>
      )}

      {/* 교환창 */}
      {showShop && (
        <div
          onClick={() => setShowShop(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99998, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              maxWidth: 340, width: '100%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            }}
          >
            <h3 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 20, letterSpacing: 2,
              color: 'var(--text-primary)', marginBottom: 4,
            }}>
              🎫 {T.shop}
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              원판 {PLATE_RULE.perTicket}개로 티켓 1장을 삽니다. 산 티켓은 파칭코와 사다리에서 씁니다.
            </p>

            {/* 수량 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10, marginBottom: 12,
            }}>
              <button
                className="btn-secondary"
                {...holdStep(-1)}
                disabled={qty <= 1}
                style={{
                  width: 44, padding: '8px 0', fontSize: 18, lineHeight: 1,
                  touchAction: 'manipulation', userSelect: 'none',
                }}
                aria-label="한 장 줄이기"
              >-</button>

              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, lineHeight: 1,
                  color: 'var(--accent)',
                }}>
                  🎫 {qty}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  최대 {affordable}장
                </div>
              </div>

              <button
                className="btn-secondary"
                {...holdStep(1)}
                disabled={qty >= affordable}
                style={{
                  width: 44, padding: '8px 0', fontSize: 18, lineHeight: 1,
                  touchAction: 'manipulation', userSelect: 'none',
                }}
                aria-label="한 장 늘리기"
              >+</button>
            </div>

            {/* 빠른 선택 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[1, 5, 10].map(n => (
                <button
                  key={n}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '7px 0', fontSize: 12 }}
                  disabled={affordable < n}
                  onClick={() => setQty(n)}
                >{n}장</button>
              ))}
              <button
                className="btn-secondary"
                style={{ flex: 1, padding: '7px 0', fontSize: 12 }}
                disabled={affordable < 1}
                onClick={() => setQty(affordable)}
              >{T.buyMax}</button>
            </div>

            {/* 계산 */}
            <div style={{
              padding: '10px 12px', borderRadius: 'var(--radius)',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.9,
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>지불</span>
                <span style={{ color: 'var(--danger)' }}>🥏 {(qty * PLATE_RULE.perTicket).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>교환 후 남는 원판</span>
                <span>🥏 {Math.max(0, plates - qty * PLATE_RULE.perTicket).toLocaleString()}</span>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={affordable < 1}
              onClick={() => {
                const got = buy(qty);
                // 더 살 수 없으면(원판이 떨어졌거나 티켓이 찼으면) 창을 닫는다.
                // 남았으면 열어둔 채 수량만 다시 맞춘다.
                const leftPlates = Math.floor((plates - got * PLATE_RULE.perTicket) / PLATE_RULE.perTicket);
                if (Math.min(leftPlates, ticketRoom - got) < 1) {
                  setShowShop(false);
                }
              }}
            >
              🎫 {qty}장 교환
            </button>
            <button
              className="btn-secondary"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => setShowShop(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
