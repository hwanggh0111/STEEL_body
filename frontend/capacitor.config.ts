import type { CapacitorConfig } from '@capacitor/cli';

// 안드로이드 앱은 **화면을 안에 싣지 않고 서버 주소를 연다** (2026-09-15).
//
// 로그인이 httpOnly 쿠키(`sameSite: strict`)로 다닌다. 화면을 APK 안에 넣으면 앱의 주소가
// `https://localhost` 가 되고 서버와 주소가 달라져 쿠키가 안 실린다 — 로그인이 안 된다.
// 서버가 화면도 같이 내주니(`backend/src/index.js` 의 frontendDist) 그 주소를 열면
// 브라우저와 똑같이 붙는다. 배포하면 앱을 다시 안 올려도 화면이 같이 바뀐다.
//
// 주소를 바꿔 만들 때: `CAP_SERVER_URL=http://192.168.0.9:5173 npx cap sync android`
// (배포 전 시험용 — 폰이 이 PC 와 같은 와이파이에 있고, 서버 둘이 떠 있어야 한다)
const url = process.env.CAP_SERVER_URL || 'https://blackiron.onrender.com';

const config: CapacitorConfig = {
  // 플레이스토어에 한 번 올리면 **영영 못 바꾼다**
  appId: 'com.blackiron.app',
  appName: 'BLACK IRON',
  // 주소를 열더라도 cap 은 이 폴더를 요구한다. 서버가 안 닿을 때의 빈 껍데기다
  webDir: 'dist',
  backgroundColor: '#12100c',
  server: {
    url,
    // http 주소(집 와이파이 시험)일 때만 평문을 허락한다
    cleartext: url.startsWith('http://'),
    // 서버에 못 닿으면 크롬의 「웹페이지를 사용할 수 없음」 대신 이 화면 (dist 안, APK 에 실린다).
    // 15초 넘게 안 열릴 때도 MainActivity 가 여기로 보낸다
    errorPath: 'app-offline.html',
  },
};

export default config;
