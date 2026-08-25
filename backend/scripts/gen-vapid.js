#!/usr/bin/env node
//
// 웹 푸시에 쓸 VAPID 키 한 쌍을 만든다.
//
//   node scripts/gen-vapid.js
//
// 나온 두 줄을 backend/.env 에 넣고, Render 에서도 같은 이름으로 넣는다.
// **개인키는 저장소에 올리지 않는다.** .env 는 gitignore 에 있다.
//
// 키를 바꾸면 지금까지 만들어진 구독이 전부 못 쓰게 된다 —
// 쓰는 사람이 알림 설정을 다시 켜야 한다. 한 번 정하면 그대로 둔다.

const webpush = require('web-push');

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('');
console.log('아래 세 줄을 backend/.env 와 Render 환경 변수에 넣으세요.');
console.log('VAPID_SUBJECT 는 문제가 생겼을 때 브라우저 푸시 서버가 연락할 곳입니다.');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:여기에_메일주소');
console.log('');
console.log('개인키는 아무 데도 올리지 마세요. 바꾸면 지금 있는 알림 구독이 전부 끊깁니다.');
console.log('');
