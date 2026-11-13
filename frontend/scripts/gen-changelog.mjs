// 최근 바뀐 것 목록을 git 커밋에서 뽑아 src/data/changelog.json 으로 쓴다.
//
// 손으로 적으면 두 가지가 어긋난다 — 적는 걸 잊거나, 적어놓고 실제와 달라지거나.
// 커밋은 어차피 남기므로 그걸 읽으면 둘 다 안 생긴다.
//
// 실행: npm run changelog  (dev / build 앞에서 자동으로 돈다)
//
// 이 스크립트는 절대 실패로 끝나지 않는다. git 이 없거나 저장소가 아니어도
// 있던 json 을 그대로 두고 조용히 빠진다 — 빌드를 막을 이유가 없다.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/changelog.json');
// json 에 담을 개수. 화면에서 몇 개를 보여줄지는 화면이 정한다 (홈페이지는 6줄).
// 8 이었는데, 하루에 커밋 일곱 개를 올리니 어제 것이 통째로 밀려났다.
// 공지함은 "전부 보기" 라고 해놓고 최근 8건만 들고 있었다.
//
// ── **40 → 80** ── (2026-11-13)
//
// 묶는 손을 걷어내니(아래) 하루 줄이 늘었다 — 11/12 가 12줄에서 **15줄**, 11/11 이
// **16줄**이다. 그러자 40 막이가 **11/09 의 ★★ 둘**을 밀어냈다(루틴 열 개인 사람에게
// 「만든 루틴이 없어요」 · 못 받았는데 「불러오는 중…」이 영영 도는 것). 한 구멍을
// 막고 다른 구멍을 연 셈이다 — 밀려나는 것도 **사라지는 것**이다.
//
// **이 파일은 앱에 안 실린다.** `gen-feed.mjs` 가 빌드 때 읽어 제목만 뽑고
// (`feedIndex.json`, 항목당 ~120B), 본문은 `public/feed-detail.json` 으로 갈라
// **펼칠 때만** 받는다(10/06 에 그렇게 갈랐다). 그러니 80 으로 늘려도 첫 짐에
// 더해지는 것은 제목 40줄, 약 4.8KB(br 로 1.5KB쯤)다. 그 값이면 지난 보름을 들고 있는
// 쪽이 맞다.
const KEEP = 80;
const SCAN = 120;        // 훑을 커밋 수

// 사용자가 볼 이유가 있는 것만. chore·docs·refactor·test·style 은 화면이 안 바뀐다
const SHOWN = {
  feat: { label: '새 기능', weight: 3 },
  fix:  { label: '고침',   weight: 2 },
  perf: { label: '빨라짐', weight: 1 },
};

// feat 을 그대로 '새 기능' 으로 쓰면 어긋난다 — '공지사항 기능 제거' 가 새 기능으로 떴다.
// 커밋 종류는 무엇을 한 코드인지를 말할 뿐이고, 읽는 사람이 알고 싶은 건 없어졌는지 달라졌는지다.
// 제목으로 판단한다. 애매하면 원래 라벨을 그대로 둔다 — 틀린 라벨보다 밋밋한 라벨이 낫다.
const REMOVED = /(제거|삭제|없앴|없앤|없앰|빼냈|들어냈|정리했)/;
const CHANGED = /(바꿨|바꾼|바꿈|바뀐|바뀜|옮겼|옮긴|옮김|이동|변경|교체|개편|합쳤|나눴)/;

function labelFor(type, text) {
  if (type !== 'feat') return SHOWN[type].label;
  if (REMOVED.test(text)) return '제거';
  if (CHANGED.test(text)) return '바뀜';
  return SHOWN.feat.label;
}

// 커밋 꼬리표는 사람에게 보여줄 말이 아니다.
//
// 본문을 그대로 실었더니 「자세히」를 펼친 사람에게 `Co-Authored-By: …` 같은
// 줄이 그대로 나갔다. git 트레일러(`말머리: 값` 꼴)와 서명 줄을 걷어낸다.
const TRAILER = /^(Co-authored-by|Signed-off-by|Reviewed-by|Acked-by|Tested-by|Refs|Closes|Fixes|Change-Id):/i;

// 본문이 길면 목록이 아니라 로그가 된다. 그리고 이 파일은 앱에 통째로 실린다 —
// 40건 × 긴 본문이면 화면 하나 값의 덩어리가 된다
const DETAIL_MAX = 420;

// **여기까지만 공개한다** — 본문에 `---` 만 있는 줄이 나오면 그 뒤는 공지에서 뺀다.
//
// 커밋 본문은 「왜 그렇게 했는지」를 남기는 자리라, 보안 구멍을 고친 커밋이면
// **그 구멍을 어떻게 지나는지**가 적힌다. 그게 그대로 앱 공지함에 실렸다
// (10/2 가입 인증 커밋에서 알아챘다 — 「먼저 가입하면 관리자가 된다」가 나갔다).
//
// 커밋에서 그 설명을 빼는 것은 답이 아니다. 다음에 이 자리를 보는 사람에게 가장
// 필요한 글이다. 읽는 사람이 다르니 **자리를 나눈다** — 구분선 위는 쓰는 사람에게,
// 아래는 고치는 사람에게. 구분선이 없으면 예전처럼 본문 전부가 공지로 간다.
const CUT = /^-{3,}$/;

function cleanBody(body) {
  const all = String(body || '').split('\n');
  const cutAt = all.findIndex(l => CUT.test(l.trim()));
  const lines = (cutAt === -1 ? all : all.slice(0, cutAt))
    .filter(l => !TRAILER.test(l.trim()));
  // 꼬리표를 걷어내면 끝에 빈 줄이 남는다
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const out = lines.join('\n').trim();
  if (out.length <= DETAIL_MAX) return out || null;
  // 자를 때는 문단 경계에서 자른다. 문장 가운데서 끊으면 읽다 만 것처럼 보인다
  const cut = out.slice(0, DETAIL_MAX);
  const at = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('. '), cut.lastIndexOf('다.'));
  return (at > DETAIL_MAX * 0.5 ? cut.slice(0, at + 1) : cut).trim() + ' …';
}

function git(args) {
  return execFileSync('git', args, {
    cwd: resolve(HERE, '../..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function build() {
  // 본문(%b)까지 가져온다 — 화면에서 펼쳐 볼 '자세히' 가 된다.
  // 본문에 줄바꿈이 있으므로 레코드는  로, 항목은 탭으로 가른다
  const raw = git(['log', `-n${SCAN}`, '--date=short', '--pretty=format:%h%x09%ad%x09%s%x09%b%x1e']);

  const entries = [];
  for (const rec of raw.split('')) {
    const line = rec.trim();
    if (!line) continue;
    const [hash, date, subject, ...rest] = line.split('	');
    if (!subject) continue;
    const body = rest.join('	').trim();

    // "type(scope): 제목" 또는 "type: 제목"
    const m = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
    if (!m) continue;
    const [, type, scope, text] = m;
    const kind = SHOWN[type];
    if (!kind) continue;

    // 개발 전용 변경은 사용자에게 알릴 것이 없다.
    //
    // **한글 꼬리표도 센다** (2026-10-05). `feat(개발): …/dev 미리보기` 가 사용자
    // 공지함에 「새 기능」으로 올라갔다 — 사용자는 열 수도 없는 자리다. 규칙이
    // 영어 `dev` 만 보고 있었는데, 이 저장소의 커밋 꼬리표는 한글이 기본이다
    //
    // **검사만 고친 것도 같다** (2026-10-27). `fix(검사): 소셜 단추 검사가 조사까지
    // 글자로 찾고 있었다` 가 사용자 공지함에 「고침」으로 올라갔다 — 검사는 사용자가
    // 열 수도, 돌릴 수도 없는 자리다. 위의 `개발` 과 똑같은 까닭이라 같이 건너뛴다.
    // (화면이 안 바뀌는 변경은 안 올린다 — 8/20 에 정한 선)
    const SKIP_SCOPE = ['dev', '개발', '검사', 'test', 'ci'];
    if (SKIP_SCOPE.includes(scope) || /^\(?dev\)?/.test(scope || '')) continue;

    entries.push({
      hash, date, type, label: labelFor(type, text),
      scope: scope || null, text: text.trim(),
      detail: cleanBody(body),
    });
  }

  // ── **묶지 않는다 — 같은 날 같은 범위라도 다 남긴다** ── (2026-11-13, 주인 결정)
  //
  // 여기에 「같은 날 같은 `scope` 는 하나만」이 있었다. 세 번 고쳐 세웠는데
  // (11/05 무게 · 11/11 같은 종류끼리는 안 묶기) **그 규칙 자체가 틀렸다.**
  //
  // 11/13 에 정석이 라이브와 산출물을 해시로 전수 대조해서 잡았다 — 11/12 의 `찾기`
  // 세 건 중 `feat`(db7d260) 하나가 `fix` 둘을 덮었다. 사라진 것이 이렇다 —
  //
  //     26b07cd  **자판이 오르면 찾기 결과가 하나도 안 보였다**
  //     da893b3  「벤치」를 치면 「벤치 딥스」가 첫째였다
  //
  // 앞의 것은 **사람이 막히던 고침**이다. 그것이 소식에 없었다.
  //
  // 그리고 **11/05 의 그 자리를 다시 읽어보니 거기서도 둘이 사라졌다.** 그날 무게를
  // 들인 까닭은 「큰 것을 붙이고 → 작은 뒷손질」이었는데, 커밋 본문을 열어보면
  // `996da1f`(매일 적는 사람 위젯에 「첫 기록을 적어보세요」) · `1270804`(「undefined ·
  // 세트 · 회」 다섯 자리) · `6acb9da`(같은 수를 두 손으로 셌다)는 **뒷손질이 아니라
  // 유산소만 하는 사람으로 앱을 한 바퀴 더 걸어 찾은 서로 다른 버그**다. 아무도
  // 그것을 「붙인 기능의 뒷손질」이라고 적지 않았다 — **우리가 그렇게 가정했을 뿐이다.**
  //
  // 주인이 11/11 에 세운 선이 답이다: **「공지에서 사라지는 것이 한 줄 늘어나는 것보다
  // 나쁘다.」** 하루에 열 줄이 뜨면 목록이 길어진다. 한 건이 사라지면 **고친 것을
  // 사람이 영영 모른다.** 길이는 `KEEP` 이 막고, 공지함은 애초에 「전부 보기」다.
  //
  // **자도 같이 풀었다** — `check-changelog.cjs` 가 「더 무거운 줄에 덮인 것은 빠질 수
  // 있다」는 예외를 들고 있었다. 자와 생성기가 **같은 틀린 규칙을 알고 있어서** 이
  // 구멍은 FAIL 로 영영 안 떴다(해시 전수 대조로만 보였다). 예외를 걷었다.
  //
  // `SHOWN` 의 `weight` 는 더 이상 고르는 데 안 쓴다 — 무엇이 더 큰 소식인지는
  // 화면이 정할 일이고, 여기서는 **버리는 데** 쓰이고 있었다.
  const picked = [];
  for (const e of entries) {
    picked.push(e);
    if (picked.length >= KEEP) break;
  }

  return {
    generated: entries.length ? entries[0].date : null,  // 훑은 시점이 아니라 최신 커밋 날짜
    items: picked,
  };
}

let data;
try {
  data = build();
} catch {
  // git 이 없거나 저장소가 아니다. 있던 파일을 그대로 둔다
  if (existsSync(OUT)) process.exit(0);
  data = { generated: null, items: [] };
}

// ── 얕게 받은 저장소에서는 **있던 것을 그대로 둔다** ── (2026-10-13)
//
// `git log` 가 터지는 것만 막아뒀는데, **성공하고 몇 건만 주는 자리**가 있었다.
// Render 는 저장소를 얕게(`--depth`) 받아서 커밋이 한 개뿐이다 — 그 한 개로 뽑으면
// 1건이 되고, 깃에 든 40건짜리 파일을 **그 1건으로 덮었다.** 배포된 앱의 공지함과
// 홈페이지 소식이 통째로 비어 있었다 (10/13 에 배포 기록에서 알았다).
//
// 처음에는 「0건이면 두기」로 막았는데 **그걸로는 안 잡혔다** — 그 한 개의 커밋이
// 마침 `fix:` 라 1건이 나왔다. 셈이 아니라 **까닭**을 봐야 한다.
//
// 깃에 들어 있는 파일은 온전한 저장소에서 뽑은 것이다. 지금 뽑은 것이 **그보다
// 적다면** 「바뀐 것이 없다」가 아니라 **「뽑을 수 없었다」**는 뜻이라 안 건드린다.
function keptCount() {
  if (!existsSync(OUT)) return 0;
  try {
    const kept = JSON.parse(readFileSync(OUT, 'utf8'));
    return Array.isArray(kept.items) ? kept.items.length : 0;
  } catch { return 0; }
}

let shallow = false;
try { shallow = git(['rev-parse', '--is-shallow-repository']).trim() === 'true'; } catch { /* 모르면 아래 셈으로 본다 */ }

const kept = keptCount();
if (kept > data.items.length) {
  const why = shallow ? '얕게 받은 저장소입니다' : '뽑은 것이 더 적습니다';
  console.log(`[changelog] ${data.items.length}건만 나왔습니다 — 있던 ${kept}건을 그대로 둡니다 (${why})`);
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`[changelog] ${data.items.length}건 → src/data/changelog.json`);
