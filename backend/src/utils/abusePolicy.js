const db = require('../db');
const { notifyAdmin } = require('./mailer');

// ─────────────────────────────────────────────────────────────
// 욕설 · 비하에 대한 처벌.
//
// 원칙 하나 — 화가 난 사람과 남을 해치려는 사람은 다르게 다룬다.
// 안 되는 걸 겪고 짜증이 섞인 말은 그냥 받는다. 그걸 막으면 제보가 안 들어온다.
// 대놓고 하는 욕은 막되, 처음부터 정지시키지 않는다. 되풀이하면 그때 올린다.
//
// 사다리 (severe 누적 기준)
//   1회 — 막고 경고만. 정지 없음
//   2회 — 1일 정지
//   3회 — 3일 정지
//   4회 이상 — 7일 정지
//
// 비하 · 혐오 · 패드립(hate)은 사다리를 안 탄다. 첫 번에 7일이다.
// 남을 깎아내리려고 쓴 말은 화풀이가 아니다.
//
// 누적은 DB 에 쌓는다. 메모리에 두면 서버가 다시 뜰 때마다 초회로 돌아간다 —
// Render 는 자주 다시 뜬다.
// ─────────────────────────────────────────────────────────────

const LADDER = [
  { count: 1, days: 0 },
  { count: 2, days: 1 },
  { count: 3, days: 3 },
  { count: 4, days: 7 },
];

const MAX_DAYS = 7;

function daysFor(count) {
  let days = 0;
  for (const step of LADDER) {
    if (count >= step.count) days = step.days;
  }
  return Math.min(days, MAX_DAYS);
}

// 정지는 직접 건다. AI Guard 의 executeLevel3 을 쓰지 않는다 —
// 그 함수는 정지가 두 번 쌓이면 LEVEL 4 로 올려서 **계정과 모든 데이터를 지우고**
// IP 대역까지 블랙리스트에 넣는다. 해킹 시도를 막으려고 만든 것이라 그게 맞다.
// 하지만 욕을 세 번 한 사람의 운동 기록을 통째로 지우는 것은 전혀 다른 이야기다.
// 여기서 거는 것은 기간이 정해진 정지뿐이다. 최대 7일, 그 위는 없다.
function suspend(userId, verdict, days, count, isHate) {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const until = expiresAt.slice(0, 10);
  const reason = isHate
    ? '비하하거나 깎아내리는 표현을 썼습니다.\n'
      + `걸린 말: ${verdict.hits.join(', ')}\n`
      + `${days}일간 정지됩니다 (${until} 해제).\n`
      + '잘못 걸렸다고 생각되면 관리자에게 알려주세요. 확인하고 바로 풀어드립니다.'
    : `욕설로 걸린 것이 ${count}번째입니다.\n`
      + `걸린 말: ${verdict.hits.join(', ')}\n`
      + `${days}일간 정지됩니다 (${until} 해제).\n`
      + '잘못 걸렸다고 생각되면 관리자에게 알려주세요. 확인하고 바로 풀어드립니다.';

  db.createSuspension(userId, 3, isHate ? 'abuse-hate' : 'abuse', reason, expiresAt);
}

/**
 * 걸린 글을 처리한다. 기록을 남기고, 필요하면 정지시킨다.
 *
 * @param {number} userId
 * @param {{level:string, hits:string[]}} verdict  profanity.inspect() 의 결과
 * @param {string} where  어디서 걸렸는지 ('report' 등)
 * @param {string} text   걸린 원문 (관리자가 보고 판단할 수 있게 남긴다)
 * @returns {{blocked:boolean, days:number, count:number, message:string}}
 */
function punish(userId, verdict, where, text) {
  if (verdict.level === 'clean') {
    return { blocked: false, days: 0, count: 0, message: '' };
  }

  // 짜증에서 나온 말은 막지 않는다. 기록만 남긴다 —
  // 나중에 같은 사람이 선을 넘었을 때 흐름을 볼 수 있어야 한다
  if (verdict.level === 'mild') {
    db.addAbuseLog(userId, {
      level: 'mild', hits: verdict.hits, where, text, action: '통과 (기록만)', days: 0,
    });
    return { blocked: false, days: 0, count: 0, message: '' };
  }

  // 관리자는 처벌하지 않는다. 기록만 남긴다.
  //
  // 운영자를 자동으로 정지시키면 관리자 화면에 못 들어가고, 자기 정지를 자기가
  // 풀 수 없다. 관리자가 한 명뿐이면 서비스가 통째로 잠긴다.
  if (db.findUserById(userId)?.role === 'admin') {
    db.addAbuseLog(userId, {
      level: verdict.level, hits: verdict.hits, where, text,
      action: '관리자 — 처벌 없음 (기록만)', days: 0,
    });
    return { blocked: false, days: 0, count: 0, message: '' };
  }

  const isHate = verdict.level === 'hate';
  const count = db.countAbuse(userId) + 1;
  const days = isHate ? MAX_DAYS : daysFor(count);

  let message;
  if (isHate) {
    message = '비하하거나 깎아내리는 표현이 들어 있습니다. 이런 말은 한 번이라도 그냥 넘기지 않습니다. '
            + `${MAX_DAYS}일간 정지됩니다.`;
  } else if (days === 0) {
    message = '욕설이 들어 있어 보내지 못했습니다. 화나신 건 알겠습니다 — 그 부분을 빼고 무엇이 안 되는지만 적어주시면 그대로 받습니다. '
            + '다시 걸리면 그때는 정지됩니다.';
  } else {
    message = `욕설로 걸린 것이 ${count}번째입니다. ${days}일간 정지됩니다.`;
  }

  db.addAbuseLog(userId, {
    level: verdict.level, hits: verdict.hits, where, text,
    action: days > 0 ? `${days}일 정지` : '차단 + 경고',
    days,
  });

  if (days > 0) {
    suspend(userId, verdict, days, count, isHate);
  }

  // 관리자에게 알린다.
  //
  // 이건 간격을 두지 않는다(always). 사전이 잘못 잡았을 수 있고, 그러면 그 사람은
  // 앱을 못 쓰는 채로 방치된다. 묶어서 나중에 보내면 그만큼 늦게 풀린다.
  notifyAdmin(
    'abuse',
    days > 0 ? `${isHate ? '비하' : '욕설'}로 ${days}일 정지` : '욕설로 차단 (경고)',
    [
      `판정: ${verdict.level}`,
      `걸린 말: ${verdict.hits.join(', ')}`,
      `회원 번호: ${userId}`,
      days > 0 ? `조치: ${days}일 정지` : '조치: 차단 + 경고 (정지 없음)',
      '',
      '원문:',
      String(text || '').slice(0, 300),
      '',
      '사전이 잘못 잡았다면 관리자 화면에서 「사전이 틀렸음」 을 누르면 누적에서 빠지고 정지도 같이 풀립니다.',
    ],
    true,
  );

  return { blocked: true, days, count, message };
}

module.exports = { punish, daysFor, LADDER, MAX_DAYS };
