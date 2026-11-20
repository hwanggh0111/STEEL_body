// **내 기록을 통째로 한 장으로 받는다** (2026-11-19 · 시안 1119 ⑥ · 정석 지시서)
//
//   GET /api/export/all                         담기는 것만 미리 본다 (갯수만 · 내용 없음)
//   GET /api/export/all?parts=workouts,inbody   고른 것만 한 장으로 받는다
//
// 열쇠 이름은 화면이 정했다 — `frontend/src/components/ExportAll.jsx` 의 `PARTS` 와
// **짝이다.** 갈리면 빠진 줄을 아무도 모른다(11/17 에 받는 파일 이름이 화면과 서버에서
// 갈린 일이 있다). 자(`scripts/check-takeall.cjs`)가 **양쪽을 맞댄다.**
//
// ── 왜 생겼나 — 기능 추가가 아니라 **약속 쪽 빈틈**이다 ──
//
// 내보내는 길은 셋이었다(운동 · 인바디 · 측정 CSV). **메모 · 내 루틴 · 기구 세팅 ·
// 목표 · 알림 · 별점 · 제보 · 사진은 길이 0개**였고, 통째로 받는 길(`/backup`)은
// **관리자만**이다. 그런데 **계정은 30일 유예 뒤 지워진다**(8/31 주인 결정). 고객센터는
// 「서버에 있습니다」라고 답하고 스토어 방침에도 「받아갈 수 있다」가 있다 —
// **이미 한 약속이 어긋나 있었다.**
//
// ── ★ 모집단은 **지우는 목록**이다 ──
//
// `db.USER_COLLECTIONS`(스무 개)가 **계정을 지울 때 지우는 것들**이다. 지워질 것이면
// 꺼낼 수 있어야 하므로 **그 목록이 곧 꺼내는 목록의 모집단**이다. 아래 `담는다` 와
// `뺀다` 의 합이 그 목록과 **같은지 켤 때 확인한다**(`확인`) — 새 컬렉션이 생기는 날
// 서버가 그 자리에서 터져 알려준다. 목록을 여기 베껴 적지 않는다.
//
// ── ★ 남의 것이 섞이는 것 ──
//
// 거르는 식은 **`db.userRows` 안의 한 줄뿐**이다. 여기에는 거르는 식이 없다.
// `rawSnapshot()` 은 부르지 않는다 — 그것은 **모든 사람의 것**이다.
const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

/** 묶음 크기 권고 상한. 넘으면 **조각내야 하는 날**이다 — 사람이 받다 죽어서 알게 하지 않는다 */
const 큰묶음 = 8 * 1024 * 1024;

// ── 담는 것 — 「내가 만든 것」 ────────────────────────────────
//
// 화면의 체크 일곱(`PARTS`)은 **큰 것**을 고르는 자리다. 나머지(목표 · 알림 · 별점 ·
// 제보 · 커뮤니티 · 프로필)는 작고, 「전부 꺼낼 수 있다」가 이 건의 약속이라 **늘 담는다.**
const 담는다 = {
  workouts: { 이름: '운동 기록', 통: ['workouts'] },
  inbody: { 이름: '인바디', 통: ['inbody'] },
  measures: { 이름: '측정 기록', 통: ['measures'] },
  notes: { 이름: '메모 · 그날 메모', 통: ['notes'] },
  routines: { 이름: '내 루틴 · 계획', 통: ['myRoutines', 'plans'] },
  gym: { 이름: '기구 세팅', 통: ['gymSettings'] },
  // 사진은 **기본 꺼짐**이다 (아래 머리글)
  photos: { 이름: '사진', 통: ['photos'], 기본꺼짐: true },
  // 아래는 체크 없이 늘 담는다
  늘: {
    이름: '목표 · 알림 설정 · 별점 · 제보(내가 쓴 글) · 커뮤니티 옛 글',
    통: ['goals', 'reminders', 'ratings', 'reports', 'posts', 'postComments', 'postLikes', 'postReports'],
    늘담는다: true,
  },
};

// ── 안 담는 것 — **까닭을 파일 안에 적는다** ──────────────────
//
// `/backup` 이 사진에 대해 이미 그렇게 한다(`설명:` 줄) — **같은 선**이다.
// 안 적으면 사람은 빠진 줄을 모르고, 그것을 백업으로 믿는다.
const 뺀다 = [
  ['refreshTokens', '로그인 유지 열쇠입니다 — 그 파일이 곧 계정 열쇠가 되므로 담지 않습니다'],
  ['pushSubs', '알림 받는 기기 주소와 암호 열쇠입니다 — 주운 사람이 그 기기로 알림을 보낼 수 있어 담지 않습니다'],
  ['suspensions', '제보 처리·조치 기록은 제가 만든 것이 아니라 운영 기록입니다 — 필요하시면 고객센터로 요청해 주세요'],
  ['abuseLogs', '위와 같습니다 (운영 기록)'],
  ['routineSessions', '지금 진행 중인 한 판의 상태입니다 — 자료가 아니라 하던 일이라 담지 않습니다'],
];

// ── ★ **사진은 다른 파일에 산다** ── (2026-11-20 · 벼림)
//
// 11/19 에 「사진」 체크를 붙여 놓고 담는 일은 `db.userRows(u, ['photos'])` 에
// 맡겼다. 그런데 **그 손은 영영 빈 목록을 돌려준다** — 사진은 본 DB(`blackiron.json`)
// 가 아니라 **`photos.json` 에 따로** 살고(`loadPhotos`), `userRows` 는 본 DB만 본다.
// `db.USER_COLLECTIONS` 에도 `photos` 가 **없다**(그래서 모집단 자도 안 울었다).
//
// 드러난 꼴이 이 앱이 거듭 없애온 그 류다 — 사람이 「사진」을 켜고 받는데 사진이
// **0장**이고, 그러면서 `빠진것` 에는 **「photos 를 안 담았다」가 적히지 않는다**
// (고른 것으로 치기 때문이다). **조용히 다르게 동작하고, 그 장을 백업으로 믿는다.**
//
// 사진은 계정을 지울 때 **같이 지워진다**(`db.deleteUserPhotos`) — 그러니 꺼낼 수
// 있어야 한다는 이 건의 전제가 사진에도 그대로 걸린다.
//
// 그래서 **여기서만 따로 집는다.** `USER_COLLECTIONS` 에 `photos` 를 끼워 넣지
// 않는다 — 그 목록은 지우는 쪽이 **본 DB 를 돌 때** 쓰는 것이라(`db.js` 의 지우는
// 손) 거기 넣으면 지우는 길이 없는 통을 돌게 된다.
//
// 거르는 식은 여기 없다 — `db.getPhotos` 안의 한 줄이다(`userRows` 와 같은 선).
const 사진들 = (userId) => db.getPhotos(userId);

/** 켤 때 한 번 — **담는 것 + 뺀 것 = 지우는 목록** 인가 */
function 확인() {
  const 담은통 = Object.values(담는다).flatMap((v) => v.통).filter((k) => k !== 'photos');
  const 뺀통 = 뺀다.map(([k]) => k);
  const 다뤘다 = new Set([...담은통, ...뺀통]);
  const 안다룬것 = db.USER_COLLECTIONS.filter((k) => !다뤘다.has(k));
  if (안다룬것.length) {
    // **조용히 빠뜨리지 않는다.** 새 컬렉션이 생기면 그 사람의 그 자료는 꺼낼 길이
    // 없는 채로 30일 뒤에 지워진다 — 그것이 이 건이 고치려던 바로 그 결함이다
    throw new Error(`[exportAll] 꺼내는 목록에 없는 갈래가 있습니다: ${안다룬것.join(', ')} `
      + '— `담는다` 에 넣거나 `뺀다` 에 까닭과 함께 적어주세요 (db.USER_COLLECTIONS 와 맞춥니다)');
  }
  // ★ **사진을 집는 손이 있는가** — 위의 `photos` 는 그 목록에서 빠져 있어
  // 모집단 셈이 안 지킨다. 이름이 바뀌거나 사라지면 **그 자리에서 서버가 터져**
  // 알려준다. 그러지 않으면 11/19 처럼 **0장을 조용히 담는다**
  if (typeof db.getPhotos !== 'function') {
    throw new Error('[exportAll] 사진을 집는 손(`db.getPhotos`)이 없습니다 '
      + '— 사진은 `photos.json` 에 따로 살아 `userRows` 로는 안 나옵니다');
  }
  // 그리고 **두 벌이 되는 날을 막는다** — `photos` 가 본 DB 갈래로 들어오면
  // 여기서 따로 집을 까닭이 없어지고, 그때 두 길이 같은 것을 두 번 담는다
  if (db.USER_COLLECTIONS.includes('photos')) {
    throw new Error('[exportAll] `photos` 가 USER_COLLECTIONS 에 들어왔습니다 '
      + '— 이제 `userRows` 가 집으니 위 `사진들` 을 걷으세요 (두 번 담지 않게)');
  }
}
확인();

/** 프로필 — `users` 줄에서 **내가 적은 것만**. 비밀번호 해시 · role 은 담지 않는다 */
function 프로필(userId) {
  const u = db.findUserById(userId);
  if (!u) return null;
  return { 아이디: u.username, 메일: u.email, 닉네임: u.nickname, 가입일: u.created_at };
}

const 셈 = (것) => (Array.isArray(것) ? 것.length : (것 ? 1 : 0));

router.get('/all', auth, (req, res) => {
  const u = req.userId;
  const 고른것 = String(req.query.parts || '').split(',').map((s) => s.trim()).filter(Boolean);

  // ── 미리 보기 — **갯수만** 준다 ──
  //
  // 무엇이 담기는지 보여주고 누르게 한다(밖으로 나가는 장이다). 내용을 한 줄도 주지
  // 않는 까닭: 미리 보기 자체가 또 하나의 내보내는 길이 되면 안 된다
  if (고른것.length === 0) {
    const 목록 = Object.entries(담는다).map(([key, v]) => ({
      열쇠: key, 갈래: v.이름,
      // 사진은 **다른 파일에서 센다**(위 머리글). 여기서도 `userRows` 로 세면
      // 사진 석 장을 가진 사람에게 미리 보기가 **「0줄」이라고 말한다**
      줄: key === 'photos'
        ? 셈(사진들(u))
        : Object.values(db.userRows(u, v.통)).reduce((a, b) => a + 셈(b), 0),
      기본꺼짐: !!v.기본꺼짐, 늘담는다: !!v.늘담는다,
    }));
    return res.json({ 담기는것: 목록, 안담는것: 뺀다.map(([k, 왜]) => ({ 갈래: k, 까닭: 왜 })) });
  }

  // ── 받기 ──
  const 담을통 = [];
  for (const [key, v] of Object.entries(담는다)) {
    if (v.늘담는다 || 고른것.includes(key)) 담을통.push(...v.통);
  }
  const data = db.userRows(u, 담을통);
  // ── ★ 사진은 **여기서 따로 집는다** ── (2026-11-20 · 위 머리글)
  //
  // `userRows` 가 담을통에 `photos` 가 있어도 **빈 목록을 넣어 둔다**(본 DB 에 그
  // 갈래가 없다). 그것을 덮어쓴다 — 안 덮으면 「사진 0장」이 조용히 나간다.
  // **고르지 않으면 손도 대지 않는다**: 사진은 base64 덩어리라 켜지 않은 사람의
  // 묶음에 들어가면 그것만으로 묶음이 몇 MB 가 된다
  if (담을통.includes('photos')) data.photos = 사진들(u);
  // ── 제보는 **내가 쓴 글만** ── (정석 지시서 ②)
  //
  // 제보 본문은 내가 쓴 글이라 담는다. 그런데 같은 줄에 **관리자 쪽 칸**이 붙어 있다 —
  // `status`(처리 상태) · `reply`·`reply_at`(관리자 답) · `flagged`(자동 판정).
  // 그것은 운영 기록이고 내가 만든 것이 아니다. **줄을 통째로 담으면 그것까지 나간다.**
  if (data.reports) {
    data.reports = data.reports.map(({ status, reply, reply_at, flagged, ...내가쓴것 }) => 내가쓴것);
  }
  data.프로필 = 프로필(u);

  const 빠진것 = [
    ...뺀다.map(([k, 왜]) => `${k} — ${왜}`),
    ...(담을통.includes('photos') ? [] : ['photos — 사진은 무거워서 고르지 않으면 담지 않습니다']),
  ];

  const 장 = JSON.stringify({
    받은때: new Date().toISOString(),
    설명: '블랙아이언에서 받은 내 기록입니다.',
    // ★ **이 줄이 빠지면 사람은 이것을 백업으로 믿고 계정을 지운다** (정석 지시서 ⑦).
    // 조용히 다르게 동작하는 것이고, 이 앱이 거듭 없애온 그 류다
    되넣기: '이 파일을 앱에 다시 넣는 길은 아직 없습니다. 운동 · 인바디 · 측정은 CSV 로 받으면 다시 넣을 수 있습니다.',
    빠진것,
    data,
  }, null, 2);

  if (Buffer.byteLength(장, 'utf8') > 큰묶음) {
    // 넘겨도 보내기는 한다 — 사람의 기록을 인질로 두지 않는다. 다만 **로그에 적는다**.
    // 자(`check-takeall`)가 이 상한을 보고 운다 — 조각내야 하는 날을 그렇게 안다
    console.warn(`[exportAll] 묶음이 큽니다: ${(Buffer.byteLength(장, 'utf8') / 1048576).toFixed(1)}MB`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // ── ★ **머리글에 한글을 넣으면 500 이 난다** ── (2026-11-19, 붙이자마자 났다)
  //
  // 처음 꼴이 `filename="steelbody-내기록-...json"` 이었고 노드가 그 자리에서
  // **`Invalid character in header content` 로 던졌다** — 머리글 값은 latin1 이라
  // 한글이 못 들어간다. 받는 사람에게는 「서버에 문제가 생겼어요」로만 보이고,
  // 미리 보기는 멀쩡해서 **받기를 눌러야 드러나는** 꼴이었다.
  //
  // 고친 길은 RFC 5987 이다 — `filename` 은 **ASCII 로**(못 읽는 기기의 대비책),
  // `filename*` 에 **UTF-8 로 퍼센트 인코딩한 한글**을 같이 적는다.
  const 한글이름 = encodeURIComponent(`steelbody-내기록-${stamp}.json`);
  res.setHeader('Content-Disposition',
    `attachment; filename="steelbody-records-${stamp}.json"; filename*=UTF-8''${한글이름}`);
  res.send(장);
});

module.exports = router;
