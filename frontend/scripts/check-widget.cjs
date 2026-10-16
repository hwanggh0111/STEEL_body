// **홈 화면 위젯이 맞는 것을 보여주는가** (2026-10-16)
//
//   npm run widget     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 위젯은 **네 파일이 한 글자로 묶여 있다** —
//
//   src/data/homeWidget.js            글을 만들어 다리로 넘긴다 (WIDGET_PREFS · WIDGET_KEY)
//   MainActivity.java (AppBridge)     받아서 SharedPreferences 에 적는다
//   TodayWidget.java                  그 자리에서 읽어 그린다 (PREFS · KEY)
//   res/layout/widget_today.xml       자바가 가리키는 칸 셋이 실제로 있어야 한다
//
// **열쇠 글자가 한쪽만 바뀌면 위젯은 영원히 「앱을 열어 기록을 적어보세요」다.**
// 터지지도 않고, 로그도 안 남고, 폰에서만 보인다 — 고쳐 놓고 몇 주 뒤에 안다.
// 칸 이름(`R.id.…`)이 어긋나면 그때는 **런처가 위젯을 못 그려서 빈 칸**이 된다.
//
// 글 자체도 값으로 본다. 위젯은 좁아서 **세 줄로 접는데**, 접다가 「0일째 식어
// 있습니다」(오늘 한 부위)나 「undefined일째」가 나오면 그게 홈 화면에 박혀 있다.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const read = (f) => fs.readFileSync(f, 'utf-8');

// 화면 쪽은 ESM 이라 묶어서 불러온다 (check-share.cjs 와 같은 방법)
const out = path.join(__dirname, '.widget-bundle.cjs');
esbuild.buildSync({
  entryPoints: ['src/data/homeWidget.js'], bundle: true, format: 'cjs', outfile: out,
  platform: 'node', logLevel: 'silent',
});
const W = require(out);
fs.unlinkSync(out);

const js = read('src/data/homeWidget.js');
const widget = read('android/app/src/main/java/com/blackiron/app/TodayWidget.java');
const main = read('android/app/src/main/java/com/blackiron/app/MainActivity.java');
const layout = read('android/app/src/main/res/layout/widget_today.xml');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const info = read('android/app/src/main/res/xml/widget_today_info.xml');
const shell = read('src/components/Layout.jsx');

console.log('── 1. 열쇠 글자가 양쪽에서 같은가 ──');
const javaPrefs = (widget.match(/String PREFS = "([^"]+)"/) || [])[1];
const javaKey = (widget.match(/String KEY = "([^"]+)"/) || [])[1];
ok('자리 이름이 같다 (PREFS)', [W.WIDGET_PREFS, javaPrefs], ['blackiron_widget', 'blackiron_widget']);
ok('열쇠가 같다 (KEY)', [W.WIDGET_KEY, javaKey], ['today', 'today']);
// 받아 적는 쪽도 **그 상수를 쓴다** — 글자를 또 적으면 셋이 된다
ok('받아 적는 쪽은 상수를 쓴다', /getSharedPreferences\(TodayWidget\.PREFS/.test(main), true);
ok('  열쇠도 상수로', /putString\(TodayWidget\.KEY/.test(main), true);

console.log('');
console.log('── 2. 자바가 가리키는 칸이 레이아웃에 있는가 ──');
const ids = [...widget.matchAll(/R\.id\.([a-z_]+)/g)].map((m) => m[1]);
const inLayout = new Set([...layout.matchAll(/android:id="@\+id\/([a-z_]+)"/g)].map((m) => m[1]));
ok('가리키는 칸 넷을 센다', [...new Set(ids)].sort(), ['widget_head', 'widget_line', 'widget_root', 'widget_sub']);
ok('  레이아웃에 없는 칸을 가리키지 않는다', [...new Set(ids)].filter((i) => !inLayout.has(i)), []);
ok('레이아웃 이름이 맞다', /R\.layout\.widget_today/.test(widget), true);

console.log('');
console.log('── 3. 런처가 이 위젯을 볼 수 있는가 ──');
// **exported="true" 가 아니면 위젯 목록에 아예 안 뜬다** — 그려주는 것은 다른 앱(런처)이다
ok('receiver 가 등록돼 있다', /android:name="\.TodayWidget"/.test(manifest), true);
ok('  밖에서 볼 수 있다 (exported)', /\.TodayWidget"[\s\S]{0,200}android:exported="true"/.test(manifest), true);
ok('  갱신 방송을 받는다', /APPWIDGET_UPDATE/.test(manifest), true);
ok('  생김새 파일을 가리킨다', /@xml\/widget_today_info/.test(manifest), true);
// 30분은 안드로이드의 최솟값이다. 더 짧게 적으면 OS 가 무시하는데, 적은 사람은
// 「1분마다 바뀐다」고 믿는다
ok('갱신 주기가 30분 이상이다', Number((info.match(/updatePeriodMillis="(\d+)"/) || [])[1]) >= 1800000, true);
// 안드로이드 12 부터 PendingIntent 에 가변·불변을 밝혀야 한다 — 없으면 **그 자리에서 죽는다**
ok('누르면 앱이 열린다 (FLAG_IMMUTABLE)', /FLAG_IMMUTABLE/.test(widget), true);

console.log('');
console.log('── 4. 글을 세 줄로 접는 셈 ──');
const today = '2026-10-16';
// 한 부위도 안 한 사람 — 「아직 한 번도 안 했습니다」가 제일 앞이다
{
  const w = { '2026-10-16': [{ exercise: '벤치프레스', sets: 4, reps: 10, weight: 60 }] };
  const t = W.widgetText(w, today);
  ok('한 번도 안 한 부위가 있으면 그것부터', [t.head, t.line], ['등', '아직 한 번도 안 했습니다']);
  ok('  오늘 적은 세트를 센다', t.sets, 4);
  ok('  최근에 달군 자리를 아래 줄에', t.sub, '가슴 오늘');
}
// 여섯 부위를 다 했고 하나만 식은 사람
{
  const w = {
    '2026-10-16': [{ exercise: '벤치프레스', sets: 3, reps: 10 }, { exercise: '랫풀다운', sets: 3, reps: 10 }],
    '2026-10-15': [{ exercise: '숄더프레스', sets: 3, reps: 10 }, { exercise: '플랭크', sets: 3, reps: 1 }],
    '2026-10-14': [{ exercise: '바벨컬', sets: 3, reps: 10 }],
    '2026-10-06': [{ exercise: '스쿼트', sets: 5, reps: 5 }],
  };
  const t = W.widgetText(w, today);
  // **숫자를 글자로 박지 않는다** — 박으면 앱을 일주일 안 여는 동안 위젯이 영영
  // 「10일째」라고 말한다. 자리를 비워 보내고 위젯이 오늘 기준으로 채운다
  ok('식은 부위와 자리를 비운 줄', [t.head, t.line], ['하체', '{d}일째 식어 있습니다']);
  ok('  며칠째인지는 숫자로 따로 보낸다', t.days, 10);
  ok('  어느 날 기준인지도 같이', t.basedOn, today);
}
// 기록이 아예 없는 사람 — **빈 몸을 보여줄 자리가 아니다**
{
  const t = W.widgetText({}, today);
  ok('기록이 없으면 첫 기록을 권한다', [t.head, t.line, t.sub], ['', '첫 기록을 적어보세요', '']);
}
// 전부 이틀 안에 한 사람
{
  const w = {
    '2026-10-16': [{ exercise: '벤치프레스', sets: 3, reps: 10 }, { exercise: '랫풀다운', sets: 3, reps: 10 },
      { exercise: '숄더프레스', sets: 3, reps: 10 }, { exercise: '스쿼트', sets: 3, reps: 10 },
      { exercise: '바벨컬', sets: 3, reps: 10 }, { exercise: '플랭크', sets: 3, reps: 1 }],
  };
  const t = W.widgetText(w, today);
  ok('다 달아 있으면 부위를 안 집는다', [t.head, t.line], ['', '몸 전체가 고루 달아 있습니다']);
}
// 앞날 기록은 안 센다 (달력에서 앞날에 적을 수 있다)
{
  const w = { '2026-10-20': [{ exercise: '벤치프레스', sets: 4, reps: 10 }] };
  ok('앞날 기록으로 오늘 세트를 세지 않는다', W.widgetText(w, today).sets, 0);
}

console.log('');
console.log('── 5. 브라우저에서는 아무 일도 안 한다 ──');
ok('다리가 있을 때만 넘긴다', /typeof window\.BlackIronApp\?\.saveWidget === 'function'/.test(js), true);
// 껍데기는 **같은 판단을 직접** 한다 — `canWidget()` 을 부르려면 그 조각을 먼저
// 받아야 하고, 그러면 브라우저로 쓰는 사람도 안 쓸 5.3KB 를 받는다
ok('  껍데기도 다리를 보고 비킨다', /window\.BlackIronApp\?\.saveWidget !== 'function'\) return/.test(shell), true);
ok('  그 뒤에야 조각을 받는다', /import\('\.\.\/data\/homeWidget'\)/.test(shell), true);
ok('  위에서 미리 받지 않는다', /^import .*homeWidget/m.test(shell), false);
// 같은 글을 거듭 넘기면 폰이 위젯을 괜히 다시 그린다
ok('같은 글은 다시 안 넘긴다', /if \(seen === lastSent\) return false/.test(js), true);
// **계산을 두 벌로 만들지 않는다** — 자바에 날짜 셈이 생기면 홈과 위젯이 갈린다
// 자바가 **부위를 고르거나 말을 짓지 않는다.** 하는 일은 「{d}」에 숫자를 넣는 뺄셈뿐이다
{
  // 주석을 걷고, **자리표(`{d}일째`)만 빼고** 본다 — 그 한 군데는 숫자를 못 읽었을 때
  // 자리를 통째로 지우는 자리라 글자가 들어 있을 수밖에 없다
  const code = widget.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '').split('{d}일째 ').join('');
  ok('자바가 말을 짓지 않는다 (식어 · 부위 같은 말이 없다)', /식어|일째|부위/.test(code), false);
  ok('  {d} 를 오늘 기준으로 채운다', /ChronoUnit\.DAYS\.between/.test(code) && /replace\("\{d\}"/.test(code), true);
  // 이 줄만은 **걷어내기 전 코드**에서 본다 (위에서 자리표를 지워 봤기 때문)
  ok('  못 읽는 값이면 자리를 지운다', /replace\("\{d\}일째 ", ""\)/.test(widget), true);
}
ok('  화면은 몸 지도와 같은 계산을 본다', /from '\.\/bodyHeat'/.test(js), true);

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '곳 어긋남');
process.exit(bad === 0 ? 0 : 1);
