// 가입 걸음이 주소를 들고 있나 (2026-10-06).
//
//   npm run signup     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 오늘 가입을 **두 걸음**으로 나눴다(메일 확인 · 계정 만들기). 그때 걸음을
// `useState('mail')` 로 짰는데 **그게 구멍이었다.**
//
// 폰에서 2걸음에 서서 「어, 메일을 잘못 적었나」 하고 **뒤로를 누르면 1걸음이
// 아니라 가입 화면을 통째로 나간다** — 적은 것이 다 사라진다. 「고치기」 단추를
// 뒀지만 사람은 뒤로를 누른다. 그게 폰에서 뒤로의 뜻이기 때문이다.
//
// ── 갈래와 반대로 쌓는다 ──
//
// 같은 날 몸·기록·루틴의 **갈래**는 `replace` 로 뒀다 — 갈래마다 쌓으면 화면을
// 나가려고 다섯 번 눌러야 한다. 그런데 **걸음은 되돌아가는 것이 자연스럽다**:
// 1걸음은 2걸음의 **앞**이지 옆이 아니다. 그래서 여기만 쌓는다.
//
// 그 차이가 조용히 뒤집히기 쉬운 자리라(`replace: true` 한 줄이다) 둘 다 본다.
//
// ── 새로고침은 1걸음으로 되돌린다 ──
//
// 주소에 `step=account` 가 남아도 **메일 확인은 화면의 상태**다. 새로고침하면
// 사라지므로, 주소만 믿고 2걸음을 그리면 **아무것도 확인되지 않은 2걸음**이 뜨고
// 거기서 저장을 누르면 서버가 거절한다. 되돌리고 **왜 처음인지 한 줄 적는다** —
// 아무 말 없이 되돌리면 적은 것이 그냥 사라진 것으로 보인다.
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
// ESM 을 그대로 불러 **돌려본다** — 다른 검사들과 같은 손이다 (check-parts 등)
const esbuild = require('esbuild');
const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};
// 주석을 걷고 본다 — 머리말에 옛 모습을 적어두는 것이 이 앱의 방식이라,
// 안 걷으면 주석에 적힌 옛 코드를 살아 있는 코드로 본다
const codeOf = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(String.fromCharCode(10)).filter((l) => !/^\s*\/\//.test(l)).join(String.fromCharCode(10));

let bad = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label} → ${JSON.stringify(got)}${pass ? '' : ` (기대: ${JSON.stringify(want)})`}`);
};

const reg = codeOf(read('src/pages/RegisterPage.jsx'));

console.log('── 가입 걸음이 주소를 들고 있나 ──');
ok('주소에서 걸음을 읽는다', /params\.get\('step'\)/.test(reg), true);
// `useState` 로 되돌아가면 뒤로가 다시 가입을 통째로 나간다
ok('  useState 로 들고 있지 않다', /useState\('mail'\)/.test(reg), false);
// 1걸음을 주소에 적으면 `/register` 와 `/register?step=mail` 이 두 주소가 된다
ok('  1걸음은 주소에 안 적는다', /p\.delete\('step'\)/.test(reg), true);

console.log('');
console.log('── 걸음은 쌓고, 갈래는 안 쌓나 ──');
// 걸음 바꾸는 자리에 `replace` 가 붙으면 뒤로가 걸음을 안 되돌린다
const stepSetter = reg.match(/const setStep = \(next\) => \{[\s\S]*?\n  \};/);
ok('걸음 바꾸기에 replace 가 없다', stepSetter ? /replace/.test(stepSetter[0]) : null, false);
// 갈래 쪽은 반대여야 한다 (오늘 같이 고친 자리)
const hook = codeOf(read('src/data/useTabParam.js'));
ok('  갈래 바꾸기에는 replace 가 있다', /replace: true/.test(hook), true);

console.log('');
console.log('── 새로고침하면 1걸음으로 되돌리나 ──');
// 메일 확인이 없으면 2걸음을 그리지 않는다
ok('확인이 없으면 되돌린다', /if \(emailOk && code\.length === 6\) return;/.test(reg), true);
// 쌓으면 뒤로가 **못 쓰는 2걸음으로** 데려온다
ok('  되돌릴 때는 replace 다', /setParams\(p, \{ replace: true \}\)/.test(reg), true);
// 아무 말 없이 되돌리면 적은 것이 그냥 사라진 것으로 보인다
ok('  왜 처음인지 적는다', /가입은 아직 안 됐습니다/.test(reg), true);

console.log('');
console.log('── 서버가 참말을 하나 ──');
// 가입이 끝나면 그 메일의 번호를 지우므로, 이미 가입된 메일로 다시 제출하면
// 번호 검사에 먼저 걸려 **「인증번호를 먼저 발송해주세요」**라고 답했다 — 틀린 말이다.
// 그 말을 들은 사람은 번호를 다시 받으러 가고, 받은 다음에야 「이미 쓰는 메일」을
// 듣는다. 메일을 찾는 것은 값이 안 드는 일이라 번호 앞에 둬도 손해가 없다
const auth = codeOf(read('../backend/src/routes/auth.js'));
const register = auth.match(/router\.post\('\/register'[\s\S]*?\n\}\);/);
ok('가입 길을 찾았다', !!register, true);
if (register) {
  const body = register[0];
  const dupAt = body.indexOf('findUserByEmail');
  const codeAt = body.indexOf('checkCode(email, code)');
  ok('  이미 가입된 메일을 번호보다 먼저 본다', dupAt > -1 && codeAt > -1 && dupAt < codeAt, true);
  // 번호가 bcrypt 앞에 있는 까닭은 그대로다 — 틀린 번호마다 해시 비용을 치르지 않는다
  const hashAt = body.indexOf('bcrypt.hash');
  ok('  번호는 여전히 bcrypt 앞이다', codeAt > -1 && hashAt > -1 && codeAt < hashAt, true);
}


// ── 가려던 자리를 **끝까지** 들고 가는가 ── (2026-10-20)
//
// `PrivateRoute` 는 못 들어간 자리를 `state.from` 에 담아 로그인 화면으로 보내고,
// 로그인 화면은 그걸 받아 그 자리로 데려간다 — 9월부터 돼 있던 길이다.
//
// 그런데 **가입은 그 값을 아예 안 봤다.** 그래서 이렇게 끊겼다 —
//
//   홈페이지에서 「가입하고 열기 — 「몸 지도」 화면」 → 로그인(from=/map)
//   → 「회원가입」 (**여기서 from 이 사라진다**) → 가입 끝 → **「오늘」로 간다**
//
// 10/20 에 홈페이지에 **「가입하고 열기」라고 적어둔 뒤**로는 그게 어긋난 말이
// 아니라 **거짓말**이다. 그래서 가입도 같은 값을 보게 했고, 거르는 규칙은
// `data/afterAuth.js` **한 곳**에 뒀다 — 두 곳에 적으면 한쪽만 고쳐지는 날이 온다.
{
  console.log('');
  console.log('── 가려던 자리를 끝까지 들고 가나 ──');

  const login = read('src/pages/LoginPage.jsx');
  const register = read('src/pages/RegisterPage.jsx');

  ok('거르는 규칙이 한 곳에 있다', fs.existsSync(path.join(__dirname, '..', 'src/data/afterAuth.js')), true);
  ok('  로그인이 그것을 쓴다', /afterAuthPath\(backTo\)/.test(login), true);
  ok('  로그인에 규칙을 다시 적지 않았다', /startsWith\('\/\/'\)/.test(login), false);
  // **여기서 흘리면 다음 화면은 알 길이 없다** — 링크에 들려 보내야 한다
  ok('가입 링크가 가려던 자리를 들고 간다', /state=\{backTo \? \{ from: safeBackTo\(backTo\) \} : undefined\}/.test(login), true);
  ok('가입이 끝나면 그 자리로 간다', /navigate\(afterAuthPath\(backTo\)/.test(register), true);
  ok('  가입이 「오늘」로 못 박혀 있지 않다', /navigate\('\/home'\)/.test(register), false);
  ok('  가입도 같은 값을 읽는다', /useLocation\(\)\.state\?\.from/.test(register), true);

  // ── 규칙을 **돌려본다** ──
  //
  // 글자만 맞춰보면 「규칙이 있다」까지만 안다. 이 값은 **주소로도 들어올 수 있는
  // 자리**라(누가 링크를 만들어 보낸다) 거르는 일이 실제로 되는지가 중요하다
  const A = bundle('src/data/afterAuth.js', '.a1.cjs');
  ok('앱 안의 자리는 그대로 간다', A.afterAuthPath('/map'), '/map');
  ok('  물음표가 붙어도 그대로', A.afterAuthPath('/train?q=%EB%B2%A4%EC%B9%98'), '/train?q=%EB%B2%A4%EC%B9%98');
  // 오픈 리다이렉트 — `//남의사이트.com` 은 브라우저가 **다른 집 주소**로 읽는다
  ok('남의 집으로는 안 보낸다', A.afterAuthPath('//evil.example.com'), '/home');
  ok('  역슬래시로 꾸민 것도', A.afterAuthPath('/\\evil.example.com'), '/home');
  ok('  주소 전체를 넣어도', A.afterAuthPath('https://evil.example.com'), '/home');
  // 로그인·가입으로 되돌리면 그 자리를 맴돈다
  ok('로그인·가입으로 되돌리지 않는다', [A.afterAuthPath('/login'), A.afterAuthPath('/register')], ['/home', '/home']);
  ok('  들고 온 것이 없으면 「오늘」', [A.afterAuthPath(undefined), A.afterAuthPath('')], ['/home', '/home']);
}

console.log('\n' + (bad ? `${bad}건 실패` : '전부 통과'));
process.exit(bad ? 1 : 0);
