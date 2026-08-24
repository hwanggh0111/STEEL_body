// 보안 설정을 한 곳에 둔다.
//
// index.js 가 실제로 적용하고, 관리자 화면의 보안 대시보드가 같은 값을 읽어 보고한다.
// 두 곳에 손으로 적어두면 반드시 어긋난다 — 실제로 어긋나 있었다. 대시보드는
// `분당 100회` 를 `15분당 100회` 로, 로그인 제한은 아예 없는 값으로 보고하고 있었다.

// Rate limit — windowMs(ms) 당 max 회
const RATE_LIMITS = {
  global:      { windowMs: 60 * 1000,          max: 100 },
  login:       { windowMs: 15 * 60 * 1000,     max: 20  },
  authCode:    { windowMs: 60 * 1000,          max: 3   },
  verifyCode:  { windowMs: 15 * 60 * 1000,     max: 10  },
  checkName:   { windowMs: 60 * 1000,          max: 10  },
  checkEmail:  { windowMs: 60 * 1000,          max: 10  },
  oauth:       { windowMs: 60 * 60 * 1000,     max: 10  },
};

const JWT = {
  algorithm: 'HS256',
  // 짧게 두고 refresh 로 늘린다. 대시보드가 이 문자열을 그대로 보여준다
  accessExpiry: '15m',
  refreshExpiry: '7d',
  refreshMs: 7 * 24 * 60 * 60 * 1000,
};

const BCRYPT_ROUNDS = 12;

// 사진을 base64 로 보내기 때문에 넉넉하다. photoLimit 과 짝이다
const BODY_LIMIT = '3mb';

module.exports = { RATE_LIMITS, JWT, BCRYPT_ROUNDS, BODY_LIMIT };
