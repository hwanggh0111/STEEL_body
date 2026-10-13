// 플레이스토어에 올릴 것을 뽑는다 (2026-10-09).
//
//   node scripts/build-android.mjs        AAB  (플레이스토어 업로드용)
//   node scripts/build-android.mjs apk    APK  (폰에 직접 깔아보는 용)
//
// ── 왜 gradlew 를 그냥 부르지 않는가 ──
//
// `android/local.properties` 에 `sdk.dir` 을 적는 것이 보통인데 **이 PC 에서는 안 된다.**
// SDK 경로에 한글(`C:\Users\케빈12\...`)이 들어 있고, Gradle 은 local.properties 를
// **ISO-8859-1 로 읽는다** — 한글이 깨져 엉뚱한 경로가 되고 R8 단계에서
// 「파일 이름, 디렉터리 이름 또는 볼륨 레이블 구문이 잘못되었습니다」로 멎는다.
// 환경변수 ANDROID_HOME 으로 주면 그 변환을 안 거치므로 멀쩡하다.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const android = path.join(root, 'android');

function findSdk() {
  for (const p of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
    path.join(homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
    path.join(homedir(), 'Library', 'Android', 'sdk'),
    path.join(homedir(), 'Android', 'Sdk')]) {
    if (p && existsSync(path.join(p, 'platform-tools'))) return p;
  }
  return null;
}

const sdk = findSdk();
if (!sdk) {
  console.error('[android] Android SDK 를 못 찾았다. ANDROID_HOME 을 정해주세요.');
  process.exit(1);
}

// local.properties 가 남아 있으면 ANDROID_HOME 보다 먼저 읽혀 위의 깨짐이 되살아난다
const stale = path.join(android, 'local.properties');
if (existsSync(stale)) {
  console.error(`[android] ${stale} 가 있습니다 — 한글 경로가 깨지니 지우고 다시 해주세요.`);
  process.exit(1);
}

const apk = process.argv[2] === 'apk';
const task = apk ? 'assembleRelease' : 'bundleRelease';
const out = apk
  ? 'android/app/build/outputs/apk/release/app-release.apk'
  : 'android/app/build/outputs/bundle/release/app-release.aab';

if (!existsSync(path.join(android, 'keystore.properties'))) {
  console.error('[android] android/keystore.properties 가 없습니다 — 디버그 열쇠로 서명되어 플레이스토어에 못 올립니다.');
  if (!apk) process.exit(1);
}

console.log(`[android] SDK: ${sdk}`);
// gradlew.bat 은 배치파일이라 직접 spawn 이 안 된다. shell:true 로 하면 인자가
// 그대로 이어붙어 경고가 뜨므로 cmd.exe 를 명시해서 부른다
const win = process.platform === 'win32';
const [cmd, argv] = win
  ? ['cmd.exe', ['/c', path.join(android, 'gradlew.bat'), task, '--console=plain']]
  : [path.join(android, 'gradlew'), [task, '--console=plain']];
const r = spawnSync(cmd, argv,
  { cwd: android, stdio: 'inherit', env: { ...process.env, ANDROID_HOME: sdk } });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`\n[android] ${out}`);
