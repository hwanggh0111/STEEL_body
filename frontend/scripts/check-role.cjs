// 들어오는 길 셋이 같은 것을 담는가 (2026-10-01).
//
//   npm run role     (npm run check 에도 들어 있다)
//
// 들어오는 길이 셋이다 — **이메일 로그인 · 가입 · 소셜(구글)**. 셋은 같은 자리에
// 닿아야 하는데, 한 길에만 적어두는 실수가 **이미 두 번** 났다:
//
//   9/18 「로그인하면 앱 잠금을 놓는다」 — 소셜 길만 비껴갔다
//   10/1 「역할(ironlog_role)을 담는다」 — 소셜 길만 비껴갔다
//
// 둘 다 **눈으로는 안 보이는 종류**다. 관리자 메뉴는 「구글로만 들어온 관리자」에게만
// 안 보이고, 그런 사람은 보통 하나뿐이다. 그래서 값으로 본다.
const fs = require('fs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 주석은 떼고 본다 — 「적어만 둔 것」과 「실제로 하는 것」을 가르는 검사다
const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');
const read = (f) => codeOf(fs.readFileSync(f, 'utf-8'));

const store = read('src/store/authStore.js');
const app = read('src/App.jsx');

// 들어오는 길 셋을 잘라낸다 (다음 함수가 시작되기 전까지)
const bodyOf = (src, name) => {
  const i = src.indexOf(name + ':');
  if (i < 0) return '';
  const rest = src.slice(i);
  const j = rest.search(/\n  [a-zA-Z]+:/);
  return j < 0 ? rest : rest.slice(0, j);
};

const login = bodyOf(store, 'login');
const register = bodyOf(store, 'register');
const social = bodyOf(store, 'socialLoggedIn');

console.log('── 들어오는 길이 셋 다 있는가 ──');
ok('이메일 로그인', login.length > 0, true);
ok('가입', register.length > 0, true);
ok('소셜', social.length > 0, true);

console.log('\n── 셋 다 「무엇을 할 수 있는 사람인지」를 담는가 ──');
// 소셜은 주소줄로 받지 않고 **서버에 다시 묻는다** — 그래서 모양이 다른 것이 맞다
const getsRole = (b) => /ironlog_role/.test(b) || /checkAuth\(\)/.test(b);
ok('이메일 로그인', getsRole(login), true);
ok('가입', getsRole(register), true);
ok('소셜 (서버에 다시 묻는다)', getsRole(social), true);

console.log('\n── 셋 다 앱 잠금을 놓는가 (9/18) ──');
const releases = (b) => /useLockStore\.getState\(\)\.release\(\)/.test(b);
ok('이메일 로그인', releases(login), true);
ok('가입', releases(register), true);
ok('소셜', releases(social), true);

console.log('\n── 소셜은 주소줄의 role 을 믿지 않는가 ──');
// 주소줄 값은 사람이 고쳐서 보낼 수 있다. 담는 것은 서버가 말해준 것이어야 한다
const page = read('src/pages/LoginPage.jsx');
ok('주소줄에서 role 을 꺼내 쓰지 않는다', /searchParams\.get\(['"]role['"]\)/.test(page), false);
ok('  담는 것도 아니다', /saveLS\(\s*['"]ironlog_role['"]/.test(page), false);

console.log('\n── checkAuth 를 실제로 부르는가 ──');
// 「앱 시작 시 호출」이라고 적어만 두고 아무도 안 부르고 있었다 (10/1 에 찾음)
ok('앱이 뜰 때 부른다', /checkAuth\(\)/.test(app), true);
ok('  로그인 상태일 때만 부른다', /isLoggedIn\s*\)?\s*&&?[\s\S]{0,40}checkAuth\(\)|isLoggedIn\)\s*useAuthStore\.getState\(\)\.checkAuth\(\)/.test(app), true);

console.log('\n── 못 물어본 것과 아니라고 들은 것을 가르는가 ──');
const check = bodyOf(store, 'checkAuth');
ok('401/403 일 때만 로그인을 끈다', /401|403/.test(check), true);
ok('  그 밖의 실패에는 상태를 안 건드린다', /set\(\{\s*isLoggedIn:\s*false\s*\}\)/g.test(check) && (check.match(/isLoggedIn: false/g) || []).length === 1, true);

console.log('\n── 관리자에서 내려오면 담아둔 것도 지우는가 ──');
ok('관리자가 아니면 지운다', /removeLS\(['"]ironlog_role['"]\)/.test(check), true);

console.log(bad === 0 ? '\n전부 통과' : '\n' + bad + '건 실패');
process.exit(bad === 0 ? 0 : 1);
