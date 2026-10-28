// 기본값으로 되돌리기 (2026-10-01).
//
//   npm run reset     (npm run check 에도 들어 있다)
//
// 설정함에 「기본값으로 되돌리기」를 붙였다. 이 기능의 위험은 **조용히 늙는 것**이다 —
// 설정을 하나 늘렸는데 되돌리기에 안 적으면, 눌러도 **그것만 안 돌아간다.**
// 터지지도 않고 눈으로도 안 보인다(그 하나를 기억하고 확인하는 사람이 있어야 한다).
//
// 그래서 **값을 손으로 적지 않게** 만들었다 — 담아둔 열쇠를 통째로 돌면서 지우고,
// 처음 값을 만드는 함수를 스토어가 설 때와 되돌릴 때가 **같이 쓴다.**
// 여기서는 그 모양이 유지되는지를 본다.
//
// 그리고 **안 건드린다고 적어둔 것**을 진짜로 안 건드리는지도 본다. 기록·잠금까지
// 지우는 줄 알면 아무도 못 누르고, 실제로 지우면 그것은 사고다.
const fs = require('fs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');
const read = (f) => codeOf(fs.readFileSync(f, 'utf-8'));

const settings = read('src/store/settingsStore.js');
const rest = read('src/store/restTimerStore.js');
const page = read('src/pages/SettingsPage.jsx');
const keys = read('src/data/localKeys.js');

console.log('── 처음 값을 한 곳에서 만드는가 ──');
// 두 군데에 적으면 설정을 늘릴 때 한쪽을 빠뜨린다 — 오늘만 그 모양을 세 번 봤다
ok('설정: 처음 값이 함수 하나다', /const initial = \(\) => \(\{/.test(settings), true);
ok('  스토어가 그것으로 선다', /\.\.\.initial\(\)/.test(settings), true);
ok('  되돌리기도 그것을 쓴다', /set\(initial\(\)\)/.test(settings), true);
ok('휴식: 취향이 함수 하나다', /const initialPrefs = \(\) => \(\{/.test(rest), true);
ok('  스토어가 그것으로 선다', /\.\.\.initialPrefs\(\)/.test(rest), true);
ok('  되돌리기도 그것을 쓴다', /set\(initialPrefs\(\)\)/.test(rest), true);

console.log('\n── 열쇠를 손으로 적지 않는가 ──');
// 손으로 적으면 새 설정이 늘 때 여기를 고쳐야 하고, 그 한 번을 잊으면 조용히 틀린다
ok('설정: 담아둔 열쇠를 통째로 돈다', /Object\.values\(SETTINGS_KEYS\)\.forEach/.test(settings), true);
ok('휴식: 취향 열쇠를 목록으로 돈다', /PREF_KEYS\.forEach/.test(rest), true);

// 휴식 취향 열쇠는 목록이라 **빠뜨릴 수 있다.** 스토어가 읽는 열쇠가 모두 그 목록에 있는가
{
  const prefLine = (rest.match(/const PREF_KEYS = \[([^\]]*)\]/) || [])[1] || '';
  const listed = prefLine.split(',').map(x => x.trim()).filter(Boolean);
  // `initialPrefs` 안에서 실제로 읽는 열쇠
  const body = (rest.match(/const initialPrefs = \(\) => \(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const used = [...new Set((body.match(/LS_[A-Z]+/g) || []))];
  const missing = used.filter(k => !listed.includes(k));
  ok('읽는 열쇠가 모두 지우는 목록에 있다', missing, []);
}

console.log('\n── 안 건드린다고 적은 것을 진짜로 안 건드리는가 ──');
const btn = (page.match(/기본값으로 되돌릴까요[\s\S]{0,900}?\);/) || [''])[0];
ok('되돌리기 단추가 있다', /기본값으로 되돌리기/.test(page), true);
ok('  로그인을 안 건드린다', /logout|leaveApp/.test(btn), false);
ok('  앱 잠금을 안 지운다', /LOCK_KEY_NAME|clearLock/.test(btn), false);
ok('  내가 만든 소리를 안 지운다', /CUSTOM_TONES|saveTones/.test(btn), false);
ok('  서버 기록에 손대지 않는다', /client\.(delete|post|put)/.test(btn), false);
// 잠금 열쇠는 설정 열쇠 묶음 **밖에** 있어야 한다 — 안에 있으면 통째로 도는 순간 지워진다
ok('앱 잠금 열쇠는 설정 묶음 밖이다', /SETTINGS_KEYS = \{[^}]*LOCK_KEY_NAME/s.test(keys), false);
ok('  내가 만든 소리도 밖이다', /SETTINGS_KEYS = \{[^}]*CUSTOM_TONES_KEY/s.test(keys), false);

console.log('\n── 눌러보기 전에 말해주는가 ──');
ok('무엇이 돌아가는지 적는다', /처음 값으로 돌아가요/.test(page), true);
ok('  무엇을 안 건드리는지도 적는다', /안 건드리는 것/.test(page), true);
ok('  한 번 묻는다', /confirmDialog\([\s\S]{0,40}이 기기의 설정을/.test(page), true);

// ── 돌려놓는 것을 **하나하나** 적는가 (2026-10-28) ──
//
// 위의 「무엇이 돌아가는지 적는다」는 **글자 하나**(「처음 값으로 돌아가요」)만 봤다.
// 그래서 안내문이 「운동할 때 · 마이크 · 숨 · 알림 소리 · 휴식 길이」라고 묶음
// 이름으로 뭉개두고 **넷을 빠뜨린 채** 통과했다 — 진동 · 세트를 적으면 저절로 ·
// 소리 크기 · **인바디 점수 보기**. 마지막 것은 더 나빴다: 아래 「안 건드리는 것」에
// 「인바디」가 있어서, **켜둔 사람은 안 건드린다고 읽고 꺼진 것을 본다.**
//
// 열쇠 이름과 사람에게 보일 말은 **글자로 이을 수 없다**(`steelbody_set_prbanner`
// 에서 「최고 기록」이 안 나온다). 그래서 **자리마다 여기 적어두고, 새 열쇠가 늘면
// FAIL** 한다 — 세는 것이 아니라 사람이 정하는 일이다.
console.log('\n── 돌려놓는 것을 하나하나 적는가 ──');
{
  // 열쇠 → 안내문의 「돌아가는 것」 칸에 **반드시** 있어야 하는 말
  const SAY = {
    keepAwake: '화면 켜두기',
    voiceLog: '목소리로',
    prBanner: '최고 기록',
    finishCard: '오늘 한 것',
    breath: '숨 보고 쉬기',
    breathWhere: '어디서',
    breathMax: '얼마나',
    breathSense: '예민하게',
    inbodyScore: '인바디 점수',
    LS_DURATION: '휴식 시간',
    LS_AUTO: '저절로',
    LS_SOUND: '소리로 알리기',
    LS_VIBRATE: '진동',
    LS_TONE: '어떤 소리로',
    LS_VOLUME: '소리 크기',
  };

  // 안내문에서 **「돌아가는 것」 쪽만** 잘라 본다 — 아래 「안 건드리는 것」에도
  // 「알림 소리」가 있어서, 통째로 보면 거짓 통과한다
  const dialog = (page.match(/이 기기의 설정을[\s\S]*?confirmText/) || [''])[0];
  const goes = dialog.split('안 건드리는 것')[0];

  const inner = (keys.match(/SETTINGS_KEYS = \{([\s\S]*?)\};/) || ['', ''])[1];
  const settingKeys = [...inner.matchAll(/^\s*([A-Za-z]+)\s*:/gm)].map((m) => m[1]);
  const prefKeys = ((rest.match(/const PREF_KEYS = \[([^\]]*)\]/) || ['', ''])[1])
    .split(',').map((x) => x.trim()).filter(Boolean);
  const all = [...settingKeys, ...prefKeys];

  ok('되돌려놓는 열쇠를 다 찾았다', all.length >= 15, true);
  // **새 설정이 늘면 여기서 멈춘다** — 사람에게 보일 말을 정해 위에 적어야 한다
  ok('  말을 정해두지 않은 열쇠가 없다', all.filter((k) => !SAY[k]), []);
  // 정해둔 말이 안내문에 실제로 있는가
  ok('  돌려놓는 것을 하나하나 적는다',
    all.filter((k) => SAY[k] && !goes.includes(SAY[k])).map((k) => k + '(' + SAY[k] + ')'), []);
  // 「인바디」 한 낱말이 두 가지를 가리키지 않는가
  ok('  안 건드리는 쪽은 「인바디 기록」이라 적는다', /· 기록 · 사진 · 인바디 기록/.test(page), true);
}

console.log('\n── 돌고 있는 휴식은 안 건드리는가 ──');
// 쉬는 중에 눌렀다고 타이머가 사라지면 몇 초를 쉬었는지 잃는다
{
  const body = (rest.match(/resetPrefs: \(\) => \{([\s\S]*?)\n  \},/) || [])[1] || '';
  ok('deadline 을 안 건드린다', /deadline/.test(body), false);
  ok('  남은 시간도 안 건드린다', /leftMs|runSec/.test(body), false);
}

console.log(bad === 0 ? '\n전부 통과' : '\n' + bad + '건 실패');
process.exit(bad === 0 ? 0 : 1);
