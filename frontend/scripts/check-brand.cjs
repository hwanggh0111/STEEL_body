// **앱 이름이 한 벌인가** (2026-11-10).
//
//   npm run brand     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 이름이 **두 벌**이었다. 앱은 `BLACK IRON` 이라고 말하고(`index.html` ·
// `manifest.json` · 패키지 `com.blackiron.app`), 문서는 `STEEL BODY` 라고 말했다.
//
// 문서 제목만이면 흉일 뿐인데, **한 자리가 그냥 흉이 아니었다** —
//
//   `docs/social-login-setup.md` 의 「애플리케이션 이름 — STEEL BODY
//    (로그인 동의 화면에 이 이름이 뜹니다)」
//
// 그 칸에 적는 이름이 **네이버·X 동의 화면에 그대로 뜬다.** 「STEEL BODY 에
// 로그인」이라고 뜨면 `BLACK IRON` 을 깐 사람은 **거기서 멈춘다**(「내 앱이 아닌데?」).
// 사람이 막히는 자리라 흉이 아니라 결함이다.
//
// 11/3 의 한도 류(`c241638`)와 결이 같다 — **같은 것을 두 곳에 따로 적어두면
// 어느 순간 한쪽만 바뀐다.** 그래서 쌍둥이를 견주는 자를 세우는 것이다.
//
// ── 무엇을 보는가 ──
//
// ⑴ 앱이 말하는 이름이 **한 벌인가** — `index.html` 의 `<title>` · `og:site_name` ·
//    `apple-mobile-web-app-title` · `description`, `manifest.json` 의 `name` ·
//    `short_name`. 하나라도 다르면 FAIL.
// ⑵ **옛 이름이 살아 있는 자리가 없는가.**
// ⑶ 사람에게 보이는 이름을 적는 자리(소셜 로그인 설정 문서)가 **앱과 같은가.**
//
// ── 첫 판이 거짓 FAIL 여덟을 냈다 ──
//
// 옛 일지 줄과, 내가 방금 적은 「11/10 까지 STEEL BODY 라고 적어두고 있었다」 줄까지
// 잡았다. **코드가 아니라 자를 고쳤다** — 그때 그랬다는 기록은 고치면 거짓이 된다.
// 날짜 꼴을 `2026-08-28` 하나만 봤는데 일지는 `11/10` 꼴도 쓴다. 셋을 넘긴다 —
// 파일 이름에 날짜가 박힌 문서 · 루트 README 의 일지 본문 · 날짜가 같은 줄에 있는 것.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// 이 앱의 이름. **여기 한 곳만 고치면 아래가 전부 따라온다**
const BRAND = 'BLACK IRON';
// 버린 이름들
const OLD_NAMES = ['STEEL BODY', 'STEELBODY'];
// 날짜가 같은 줄에 있으면 그때의 말이다
const HAS_DATE = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}/;
// 파일 이름에 날짜가 박힌 문서는 그날의 기록이다
const isRecord = (rel) => /\d{4}-\d{2}-\d{2}/.test(rel);
// 루트 README 는 날짜별 개발 일지다 — 머리 쪽만 현재 서술이다
const README_HEAD = 60;

console.log('── 앱이 말하는 이름이 한 벌인가 ──');
{
  const html = read('frontend/index.html');
  const pick = (re) => { const m = re.exec(html); return m ? m[1].trim() : null; };
  ok('<title>', pick(/<title>([^<]*)<\/title>/), BRAND);
  ok('og:site_name', pick(/property="og:site_name"\s+content="([^"]*)"/), BRAND);
  ok('apple-mobile-web-app-title', pick(/name="apple-mobile-web-app-title"\s+content="([^"]*)"/), BRAND);
  // 설명 줄은 이름으로 **시작**해야 한다
  const desc = pick(/name="description"\s+content="([^"]*)"/);
  ok('description 이 그 이름으로 시작한다', !!desc && desc.startsWith(BRAND), true);

  const mani = JSON.parse(read('frontend/public/manifest.json'));
  ok('manifest name', mani.name, BRAND);
  ok('manifest short_name', mani.short_name, BRAND);
}

console.log('');
console.log('── 옛 이름이 살아 있는 자리가 없는가 ──');
{
  // 문서와 화면 글자만 본다 — 생성물·잠금 파일은 안 본다
  const files = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let names;
    try { names = fs.readdirSync(path.join(REPO, dir), { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      const rel = dir ? dir + '/' + e.name : e.name;
      if (e.isDirectory()) walk(rel, depth + 1);
      else if (/\.(md|html|jsx?|json)$/.test(e.name) && !/package-lock|changelog|feed/.test(e.name)) files.push(rel);
    }
  };
  walk('docs', 0);
  walk('frontend/src', 0);
  walk('frontend/public', 0);
  files.push('frontend/index.html', 'README.md');

  const left = [];
  for (const f of files) {
    if (isRecord(f)) continue;
    let s;
    try { s = read(f); } catch { continue; }
    let rows = s.split('\n');
    if (f === 'README.md') rows = rows.slice(0, README_HEAD);
    for (const old of OLD_NAMES) {
      rows.forEach((line, i) => {
        if (line.includes(old) && !HAS_DATE.test(line)) left.push(f + ':' + (i + 1));
      });
    }
  }
  ok('★ 옛 이름이 남아 있지 않다', left, []);
  console.log('     (기록 문서 · README 일지 본문 · 날짜가 같은 줄에 있는 것은 넘긴다)');
}

console.log('');
console.log('── 사람에게 보이는 이름을 적는 자리 ──');
{
  // 이 칸에 적는 이름이 **네이버·X 동의 화면에 그대로 뜬다**
  const s = read('docs/social-login-setup.md');
  const m = /\*\*애플리케이션 이름\*\*\s*—\s*`([^`]+)`/.exec(s);
  ok('네이버 동의 화면에 뜰 이름', m ? m[1] : null, BRAND);
  ok('  까닭을 적어뒀다 (다음 사람이 또 어긋내지 않게)',
    /한 글자도 다르면 안 된다/.test(s), true);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
