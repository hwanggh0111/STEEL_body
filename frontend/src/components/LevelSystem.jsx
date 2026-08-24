import { useState } from 'react';
import { useLangStore } from '../store/langStore';

// 30티어 × 5레벨 = 150레벨 (LV 0 ~ LV 149)
const LEVEL_TABLE = [
  // 0~4: T1 입문
  { level: 0,   exp: 0,                tier: 1,  title: { ko: '입문자',          en: 'Beginner'             }, icon: '🌱', color: '#888' },
  { level: 1,   exp: 150,              tier: 1,  title: { ko: '첫걸음',          en: 'First Step'           }, icon: '🐣', color: '#888' },
  { level: 2,   exp: 318,              tier: 1,  title: { ko: '운동 시작',       en: 'Started'              }, icon: '🔥', color: '#999' },
  { level: 3,   exp: 505,              tier: 1,  title: { ko: '적응 단계',       en: 'Adapting'             }, icon: '💪', color: '#a0a0a0' },
  { level: 4,   exp: 715,              tier: 1,  title: { ko: '입문 졸업',       en: 'Graduated'            }, icon: '🎓', color: '#aaa' },
  // 5~9: T2 초보
  { level: 5,   exp: 949,              tier: 2,  title: { ko: '초보 헬린이',     en: 'Newbie Lifter'        }, icon: '🏋️', color: '#b8860b' },
  { level: 6,   exp: 1210,             tier: 2,  title: { ko: '운동 습관',       en: 'Habit Builder'        }, icon: '📅', color: '#b8860b' },
  { level: 7,   exp: 1500,             tier: 2,  title: { ko: '꾸준함',          en: 'Steady'               }, icon: '🏃', color: '#cd853f' },
  { level: 8,   exp: 1830,             tier: 2,  title: { ko: '초보 강자',       en: 'Strong Newbie'        }, icon: '💥', color: '#cd853f' },
  { level: 9,   exp: 2200,             tier: 2,  title: { ko: '초보 마스터',     en: 'Newbie Master'        }, icon: '🎯', color: '#daa520' },
  // 10~14: T3 중급
  { level: 10,  exp: 2610,             tier: 3,  title: { ko: '중급 진입',       en: 'Mid Lifter'           }, icon: '🔥', color: '#ff6b1a' },
  { level: 11,  exp: 3070,             tier: 3,  title: { ko: '헬스 매니아',     en: 'Gym Maniac'           }, icon: '⚡', color: '#ff6b1a' },
  { level: 12,  exp: 3580,             tier: 3,  title: { ko: '근육 사냥꾼',     en: 'Muscle Hunter'        }, icon: '🏹', color: '#ff6b1a' },
  { level: 13,  exp: 4150,             tier: 3,  title: { ko: '철의 의지',       en: 'Iron Will'            }, icon: '🔩', color: '#ff6b1a' },
  { level: 14,  exp: 4790,             tier: 3,  title: { ko: '중급 마스터',     en: 'Mid Master'           }, icon: '🎯', color: '#ff6b1a' },
  // 15~19: T4 상급
  { level: 15,  exp: 5510,             tier: 4,  title: { ko: '상급 리프터',     en: 'Advanced Lifter'      }, icon: '💎', color: '#4a9aff' },
  { level: 16,  exp: 6310,             tier: 4,  title: { ko: '근육 조각가',     en: 'Body Sculptor'        }, icon: '🗿', color: '#4a9aff' },
  { level: 17,  exp: 7200,             tier: 4,  title: { ko: '철인',            en: 'Iron Man'             }, icon: '🦾', color: '#4a9aff' },
  { level: 18,  exp: 8200,             tier: 4,  title: { ko: '짐 마스터',       en: 'Gym Master'           }, icon: '🏅', color: '#4a9aff' },
  { level: 19,  exp: 9320,             tier: 4,  title: { ko: '상급 정점',       en: 'Advanced Peak'        }, icon: '🎯', color: '#4a9aff' },
  // 20~24: T5 엘리트
  { level: 20,  exp: 10600,            tier: 5,  title: { ko: '엘리트',          en: 'Elite'                }, icon: '⭐', color: '#c0a0ff' },
  { level: 21,  exp: 12000,            tier: 5,  title: { ko: '전설 입문',       en: 'Legend Initiate'      }, icon: '✨', color: '#c0a0ff' },
  { level: 22,  exp: 13500,            tier: 5,  title: { ko: '타이탄',          en: 'Titan'                }, icon: '🗼', color: '#c0a0ff' },
  { level: 23,  exp: 15300,            tier: 5,  title: { ko: '헤라클레스',      en: 'Hercules'             }, icon: '⚡', color: '#c0a0ff' },
  { level: 24,  exp: 17200,            tier: 5,  title: { ko: '엘리트 마스터',   en: 'Elite Master'         }, icon: '🎯', color: '#c0a0ff' },
  // 25~29: T6 전설
  { level: 25,  exp: 19400,            tier: 6,  title: { ko: '전설의 시작',     en: 'Legend Begins'        }, icon: '👑', color: '#ffd700' },
  { level: 26,  exp: 21900,            tier: 6,  title: { ko: '전설의 리프터',   en: 'Legendary'            }, icon: '🏆', color: '#ffd700' },
  { level: 27,  exp: 24600,            tier: 6,  title: { ko: '황금 보디',       en: 'Golden Body'          }, icon: '💛', color: '#ffd700' },
  { level: 28,  exp: 27600,            tier: 6,  title: { ko: '챔피언',          en: 'Champion'             }, icon: '🥇', color: '#ffd700' },
  { level: 29,  exp: 31100,            tier: 6,  title: { ko: '전설 마스터',     en: 'Legend Master'        }, icon: '🎯', color: '#ffd700' },
  // 30~34: T7 불멸
  { level: 30,  exp: 34900,            tier: 7,  title: { ko: '불멸의 시작',     en: 'Immortal Begins'      }, icon: '🔱', color: '#ff44ff' },
  { level: 31,  exp: 39100,            tier: 7,  title: { ko: '시간의 정복자',   en: 'Time Conqueror'       }, icon: '⏳', color: '#ff44ff' },
  { level: 32,  exp: 43900,            tier: 7,  title: { ko: '영원의 전사',     en: 'Eternal Warrior'      }, icon: '♾️', color: '#ff44ff' },
  { level: 33,  exp: 49200,            tier: 7,  title: { ko: '불사신',          en: 'Immortal'             }, icon: '🌟', color: '#ff44ff' },
  { level: 34,  exp: 55200,            tier: 7,  title: { ko: '불멸 마스터',     en: 'Immortal Master'      }, icon: '🎯', color: '#ff44ff' },
  // 35~39: T8 신화
  { level: 35,  exp: 61900,            tier: 8,  title: { ko: '신화의 시작',     en: 'Myth Begins'          }, icon: '🌟', color: '#ff2222' },
  { level: 36,  exp: 69300,            tier: 8,  title: { ko: '천둥의 신',       en: 'Thunder God'          }, icon: '⛈️', color: '#ff2222' },
  { level: 37,  exp: 77700,            tier: 8,  title: { ko: '전쟁의 신',       en: 'War God'              }, icon: '⚔️', color: '#ff2222' },
  { level: 38,  exp: 87000,            tier: 8,  title: { ko: '우주의 리프터',   en: 'Cosmic Lifter'        }, icon: '🌌', color: '#ff2222' },
  { level: 39,  exp: 97400,            tier: 8,  title: { ko: '신화 마스터',     en: 'Myth Master'          }, icon: '🎯', color: '#ff2222' },
  // 40~44: T9 초월
  { level: 40,  exp: 109000,           tier: 9,  title: { ko: '초월의 시작',     en: 'Transcend'            }, icon: '🔮', color: '#00ffcc' },
  { level: 41,  exp: 122000,           tier: 9,  title: { ko: '차원 파괴자',     en: 'Dimension Breaker'    }, icon: '🌀', color: '#00ffcc' },
  { level: 42,  exp: 137000,           tier: 9,  title: { ko: '만물의 리프터',   en: 'Universal'            }, icon: '🌐', color: '#00ffcc' },
  { level: 43,  exp: 153000,           tier: 9,  title: { ko: '우주의 끝',       en: 'Edge of Universe'     }, icon: '🚀', color: '#00ffcc' },
  { level: 44,  exp: 171000,           tier: 9,  title: { ko: '초월 마스터',     en: 'Transcend Master'     }, icon: '🎯', color: '#00ffcc' },
  // 45~49: T10 정점
  { level: 45,  exp: 192000,           tier: 10, title: { ko: '절대자',          en: 'Absolute'             }, icon: '🌠', color: '#ff0066' },
  { level: 46,  exp: 214000,           tier: 10, title: { ko: '무적의 보디',     en: 'Invincible Body'      }, icon: '💠', color: '#ff0066' },
  { level: 47,  exp: 240000,           tier: 10, title: { ko: '극한의 리프터',   en: 'Ultimate'             }, icon: '🔥', color: '#ff0066' },
  { level: 48,  exp: 268000,           tier: 10, title: { ko: '신을 넘은 자',    en: 'Beyond Gods'          }, icon: '⚡', color: '#ff0066' },
  { level: 49,  exp: 300000,           tier: 10, title: { ko: '신화를 넘은 자',  en: 'Beyond Myth'          }, icon: '🌟', color: '#ff0066' },
  // 50~54: T11 각성
  { level: 50,  exp: 374000,           tier: 11, title: { ko: '각성의 시작',     en: 'Awakening'            }, icon: '🌿', color: '#a0ff40' },
  { level: 51,  exp: 465000,           tier: 11, title: { ko: '한계 돌파',       en: 'Limit Breaker'        }, icon: '💢', color: '#a0ff40' },
  { level: 52,  exp: 579000,           tier: 11, title: { ko: '잠재력 해방',     en: 'Unleashed'            }, icon: '🔓', color: '#a0ff40' },
  { level: 53,  exp: 721000,           tier: 11, title: { ko: '초월한 육체',     en: 'Beyond Flesh'         }, icon: '🦿', color: '#a0ff40' },
  { level: 54,  exp: 898000,           tier: 11, title: { ko: '각성 마스터',     en: 'Awakened Master'      }, icon: '🎯', color: '#a0ff40' },
  // 55~59: T12 초인
  { level: 55,  exp: 1120000,          tier: 12, title: { ko: '초인 입문',       en: 'Superhuman'           }, icon: '🦸', color: '#40ffa0' },
  { level: 56,  exp: 1390000,          tier: 12, title: { ko: '강철 심장',       en: 'Steel Heart'          }, icon: '🫀', color: '#40ffa0' },
  { level: 57,  exp: 1730000,          tier: 12, title: { ko: '불굴의 의지',     en: 'Unbroken'             }, icon: '🛡️', color: '#40ffa0' },
  { level: 58,  exp: 2160000,          tier: 12, title: { ko: '인간 최강',       en: 'Peak Human'           }, icon: '🥊', color: '#40ffa0' },
  { level: 59,  exp: 2690000,          tier: 12, title: { ko: '초인 마스터',     en: 'Superhuman Master'    }, icon: '🎯', color: '#40ffa0' },
  // 60~64: T13 반신
  { level: 60,  exp: 3350000,          tier: 13, title: { ko: '반신 강림',       en: 'Demigod'              }, icon: '🌓', color: '#40e0ff' },
  { level: 61,  exp: 4170000,          tier: 13, title: { ko: '신의 그림자',     en: 'Gods Shadow'          }, icon: '👤', color: '#40e0ff' },
  { level: 62,  exp: 5190000,          tier: 13, title: { ko: '영웅의 피',       en: 'Heroic Blood'         }, icon: '🩸', color: '#40e0ff' },
  { level: 63,  exp: 6460000,          tier: 13, title: { ko: '신화 재림',       en: 'Myth Reborn'          }, icon: '📜', color: '#40e0ff' },
  { level: 64,  exp: 8050000,          tier: 13, title: { ko: '반신 마스터',     en: 'Demigod Master'       }, icon: '🎯', color: '#40e0ff' },
  // 65~69: T14 신격
  { level: 65,  exp: 10000000,         tier: 14, title: { ko: '신격 획득',       en: 'Divinity'             }, icon: '😇', color: '#8080ff' },
  { level: 66,  exp: 12500000,         tier: 14, title: { ko: '천상의 힘',       en: 'Celestial'            }, icon: '☁️', color: '#8080ff' },
  { level: 67,  exp: 15500000,         tier: 14, title: { ko: '신의 권능',       en: 'Authority'            }, icon: '⚖️', color: '#8080ff' },
  { level: 68,  exp: 19300000,         tier: 14, title: { ko: '올림포스',        en: 'Olympus'              }, icon: '🏛️', color: '#8080ff' },
  { level: 69,  exp: 24100000,         tier: 14, title: { ko: '신격 마스터',     en: 'Divine Master'        }, icon: '🎯', color: '#8080ff' },
  // 70~74: T15 창조
  { level: 70,  exp: 30000000,         tier: 15, title: { ko: '창조의 시작',     en: 'Genesis'              }, icon: '🌱', color: '#c060ff' },
  { level: 71,  exp: 37300000,         tier: 15, title: { ko: '세계의 설계자',   en: 'Architect'            }, icon: '📐', color: '#c060ff' },
  { level: 72,  exp: 46500000,         tier: 15, title: { ko: '생명의 근원',     en: 'Origin'               }, icon: '🧬', color: '#c060ff' },
  { level: 73,  exp: 57900000,         tier: 15, title: { ko: '만물의 창조주',   en: 'Creator'              }, icon: '🖐️', color: '#c060ff' },
  { level: 74,  exp: 72100000,         tier: 15, title: { ko: '창조 마스터',     en: 'Creation Master'      }, icon: '🎯', color: '#c060ff' },
  // 75~79: T16 무한
  { level: 75,  exp: 89800000,         tier: 16, title: { ko: '무한 개방',       en: 'Infinity'             }, icon: '♾️', color: '#ff60c0' },
  { level: 76,  exp: 112000000,        tier: 16, title: { ko: '끝없는 힘',       en: 'Endless'              }, icon: '🌊', color: '#ff60c0' },
  { level: 77,  exp: 139000000,        tier: 16, title: { ko: '영원의 순환',     en: 'Eternal Cycle'        }, icon: '🔄', color: '#ff60c0' },
  { level: 78,  exp: 173000000,        tier: 16, title: { ko: '무한 동력',       en: 'Infinite Engine'      }, icon: '⚙️', color: '#ff60c0' },
  { level: 79,  exp: 216000000,        tier: 16, title: { ko: '무한 마스터',     en: 'Infinity Master'      }, icon: '🎯', color: '#ff60c0' },
  // 80~84: T17 차원
  { level: 80,  exp: 269000000,        tier: 17, title: { ko: '차원 도약',       en: 'Dimension'            }, icon: '🌀', color: '#ff6060' },
  { level: 81,  exp: 335000000,        tier: 17, title: { ko: '평행 세계',       en: 'Parallel'             }, icon: '🪞', color: '#ff6060' },
  { level: 82,  exp: 417000000,        tier: 17, title: { ko: '시공 지배자',     en: 'Spacetime'            }, icon: '⏳', color: '#ff6060' },
  { level: 83,  exp: 519000000,        tier: 17, title: { ko: '차원의 왕',       en: 'Dimension King'       }, icon: '👑', color: '#ff6060' },
  { level: 84,  exp: 646000000,        tier: 17, title: { ko: '차원 마스터',     en: 'Dimension Master'     }, icon: '🎯', color: '#ff6060' },
  // 85~89: T18 우주
  { level: 85,  exp: 804000000,        tier: 18, title: { ko: '우주 진출',       en: 'Cosmos'               }, icon: '🚀', color: '#ffa040' },
  { level: 86,  exp: 1000000000,       tier: 18, title: { ko: '은하의 지배자',   en: 'Galactic'             }, icon: '🌠', color: '#ffa040' },
  { level: 87,  exp: 1250000000,       tier: 18, title: { ko: '별의 창조자',     en: 'Star Maker'           }, icon: '⭐', color: '#ffa040' },
  { level: 88,  exp: 1550000000,       tier: 18, title: { ko: '우주의 심장',     en: 'Cosmic Heart'         }, icon: '💫', color: '#ffa040' },
  { level: 89,  exp: 1930000000,       tier: 18, title: { ko: '우주 마스터',     en: 'Cosmos Master'        }, icon: '🎯', color: '#ffa040' },
  // 90~94: T19 특이점
  { level: 90,  exp: 2410000000,       tier: 19, title: { ko: '특이점 돌입',     en: 'Singularity'          }, icon: '🕳️', color: '#ffe040' },
  { level: 91,  exp: 3000000000,       tier: 19, title: { ko: '법칙 초월',       en: 'Beyond Law'           }, icon: '📖', color: '#ffe040' },
  { level: 92,  exp: 3730000000,       tier: 19, title: { ko: '존재의 끝',       en: 'End of Being'         }, icon: '🌑', color: '#ffe040' },
  { level: 93,  exp: 4650000000,       tier: 19, title: { ko: '무의 경지',       en: 'Void'                 }, icon: '⬛', color: '#ffe040' },
  { level: 94,  exp: 5790000000,       tier: 19, title: { ko: '특이점 마스터',   en: 'Singularity Master'   }, icon: '🎯', color: '#ffe040' },
  // 95~99: T20 절대
  { level: 95,  exp: 7210000000,       tier: 20, title: { ko: '절대 영역',       en: 'Absolute'             }, icon: '🔆', color: '#dfe6ee' },
  { level: 96,  exp: 8970000000,       tier: 20, title: { ko: '모든 것의 위',    en: 'Above All'            }, icon: '🗻', color: '#dfe6ee' },
  { level: 97,  exp: 11200000000,      tier: 20, title: { ko: '개념 그 자체',    en: 'Concept'              }, icon: '🔯', color: '#dfe6ee' },
  { level: 98,  exp: 13900000000,      tier: 20, title: { ko: '서사의 끝',       en: 'End of Story'         }, icon: '📕', color: '#dfe6ee' },
  { level: 99,  exp: 17300000000,      tier: 20, title: { ko: '신화를 만든 자',  en: 'Myth Maker'           }, icon: '🌟', color: '#dfe6ee' },
  // 100~104: T21 근원
  { level: 100, exp: 21600000000,      tier: 21, title: { ko: '근원 접촉',       en: 'Touch of Origin'      }, icon: '🫧', color: '#7de0d0' },
  { level: 101, exp: 26900000000,      tier: 21, title: { ko: '최초의 불꽃',     en: 'First Flame'          }, icon: '🕯️', color: '#7de0d0' },
  { level: 102, exp: 33400000000,      tier: 21, title: { ko: '만물의 씨앗',     en: 'Seed of All'          }, icon: '🌰', color: '#7de0d0' },
  { level: 103, exp: 41600000000,      tier: 21, title: { ko: '흐름의 지배자',   en: 'Lord of Flow'         }, icon: '🌊', color: '#7de0d0' },
  { level: 104, exp: 51800000000,      tier: 21, title: { ko: '근원 마스터',     en: 'Origin Master'        }, icon: '🎯', color: '#7de0d0' },
  // 105~109: T22 섭리
  { level: 105, exp: 64600000000,      tier: 22, title: { ko: '섭리 각성',       en: 'Providence'           }, icon: '📿', color: '#9fd8ff' },
  { level: 106, exp: 80400000000,      tier: 22, title: { ko: '운명의 실',       en: 'Thread of Fate'       }, icon: '🧵', color: '#9fd8ff' },
  { level: 107, exp: 100000000000,     tier: 22, title: { ko: '필연의 저울',     en: 'Scale of Fate'        }, icon: '⚖️', color: '#9fd8ff' },
  { level: 108, exp: 125000000000,     tier: 22, title: { ko: '예정된 자',       en: 'The Ordained'         }, icon: '🕊️', color: '#9fd8ff' },
  { level: 109, exp: 155000000000,     tier: 22, title: { ko: '섭리 마스터',     en: 'Providence Master'    }, icon: '🎯', color: '#9fd8ff' },
  // 110~114: T23 무형
  { level: 110, exp: 193000000000,     tier: 23, title: { ko: '형상 해체',       en: 'Formless'             }, icon: '🌫️', color: '#b9b9ff' },
  { level: 111, exp: 241000000000,     tier: 23, title: { ko: '경계 없음',       en: 'No Boundary'          }, icon: '⭕', color: '#b9b9ff' },
  { level: 112, exp: 300000000000,     tier: 23, title: { ko: '형상을 버린 자',  en: 'Shapeless One'        }, icon: '🫥', color: '#b9b9ff' },
  { level: 113, exp: 373000000000,     tier: 23, title: { ko: '무형의 육체',     en: 'Formless Body'        }, icon: '👻', color: '#b9b9ff' },
  { level: 114, exp: 465000000000,     tier: 23, title: { ko: '무형 마스터',     en: 'Formless Master'      }, icon: '🎯', color: '#b9b9ff' },
  // 115~119: T24 편재
  { level: 115, exp: 578000000000,     tier: 24, title: { ko: '편재 개시',       en: 'Omnipresence'         }, icon: '🕸️', color: '#d0a8ff' },
  { level: 116, exp: 720000000000,     tier: 24, title: { ko: '어디에나 있는',   en: 'Everywhere'           }, icon: '🧭', color: '#d0a8ff' },
  { level: 117, exp: 897000000000,     tier: 24, title: { ko: '동시에 존재',     en: 'Simultaneous'         }, icon: '⏱️', color: '#d0a8ff' },
  { level: 118, exp: 1120000000000,    tier: 24, title: { ko: '세계의 숨결',     en: 'Breath of World'      }, icon: '🌬️', color: '#d0a8ff' },
  { level: 119, exp: 1390000000000,    tier: 24, title: { ko: '편재 마스터',     en: 'Omnipresence Master'  }, icon: '🎯', color: '#d0a8ff' },
  // 120~124: T25 불가해
  { level: 120, exp: 1730000000000,    tier: 25, title: { ko: '불가해 영역',     en: 'Ineffable'            }, icon: '🔺', color: '#ff9de0' },
  { level: 121, exp: 2160000000000,    tier: 25, title: { ko: '이해 밖의 것',    en: 'Beyond Grasp'         }, icon: '🌪️', color: '#ff9de0' },
  { level: 122, exp: 2680000000000,    tier: 25, title: { ko: '설명 불가',       en: 'Unexplainable'        }, icon: '❔', color: '#ff9de0' },
  { level: 123, exp: 3340000000000,    tier: 25, title: { ko: '침범할 수 없는',  en: 'Inviolable'           }, icon: '🛑', color: '#ff9de0' },
  { level: 124, exp: 4160000000000,    tier: 25, title: { ko: '불가해 마스터',   en: 'Ineffable Master'     }, icon: '🎯', color: '#ff9de0' },
  // 125~129: T26 초개념
  { level: 125, exp: 5180000000000,    tier: 26, title: { ko: '개념 위의 개념',  en: 'Metaconcept'          }, icon: '🧩', color: '#ff8f8f' },
  { level: 126, exp: 6450000000000,    tier: 26, title: { ko: '정의를 쓰는 자',  en: 'The Definer'          }, icon: '✒️', color: '#ff8f8f' },
  { level: 127, exp: 8030000000000,    tier: 26, title: { ko: '법칙의 저자',     en: 'Author of Law'        }, icon: '📚', color: '#ff8f8f' },
  { level: 128, exp: 10000000000000,   tier: 26, title: { ko: '의미의 근간',     en: 'Root of Meaning'      }, icon: '🔤', color: '#ff8f8f' },
  { level: 129, exp: 12500000000000,   tier: 26, title: { ko: '초개념 마스터',   en: 'Metaconcept Master'   }, icon: '🎯', color: '#ff8f8f' },
  // 130~134: T27 원환
  { level: 130, exp: 15500000000000,   tier: 27, title: { ko: '원환 진입',       en: 'Ouroboros'            }, icon: '🔁', color: '#ffb066' },
  { level: 131, exp: 19300000000000,   tier: 27, title: { ko: '시작이자 끝',     en: 'Alpha and Omega'      }, icon: '🐍', color: '#ffb066' },
  { level: 132, exp: 24000000000000,   tier: 27, title: { ko: '영원한 회귀',     en: 'Eternal Return'       }, icon: '♻️', color: '#ffb066' },
  { level: 133, exp: 29900000000000,   tier: 27, title: { ko: '스스로 도는 것',  en: 'Self-Turning'         }, icon: '🎡', color: '#ffb066' },
  { level: 134, exp: 37300000000000,   tier: 27, title: { ko: '원환 마스터',     en: 'Ouroboros Master'     }, icon: '🎯', color: '#ffb066' },
  // 135~139: T28 침묵
  { level: 135, exp: 46400000000000,   tier: 28, title: { ko: '침묵 강림',       en: 'Silence'              }, icon: '🤫', color: '#ffd98a' },
  { level: 136, exp: 57800000000000,   tier: 28, title: { ko: '말이 닿지 않는',  en: 'Beyond Words'         }, icon: '🔇', color: '#ffd98a' },
  { level: 137, exp: 72000000000000,   tier: 28, title: { ko: '고요한 심연',     en: 'Still Depths'         }, icon: '🌫️', color: '#ffd98a' },
  { level: 138, exp: 89600000000000,   tier: 28, title: { ko: '소리 없는 자',    en: 'The Soundless'        }, icon: '🎐', color: '#ffd98a' },
  { level: 139, exp: 112000000000000,  tier: 28, title: { ko: '침묵 마스터',     en: 'Silence Master'       }, icon: '🎯', color: '#ffd98a' },
  // 140~144: T29 백지
  { level: 140, exp: 139000000000000,  tier: 29, title: { ko: '백지 상태',       en: 'Blank'                }, icon: '📄', color: '#ececec' },
  { level: 141, exp: 173000000000000,  tier: 29, title: { ko: '지워진 기록',     en: 'Erased'               }, icon: '🧽', color: '#ececec' },
  { level: 142, exp: 215000000000000,  tier: 29, title: { ko: '쓰이지 않은 것',  en: 'Unwritten'            }, icon: '🗒️', color: '#ececec' },
  { level: 143, exp: 268000000000000,  tier: 29, title: { ko: '다시 쓰는 자',    en: 'The Rewriter'         }, icon: '✏️', color: '#ececec' },
  { level: 144, exp: 334000000000000,  tier: 29, title: { ko: '백지 마스터',     en: 'Blank Master'         }, icon: '🎯', color: '#ececec' },
  // 145~149: T30 이름 없는 것
  { level: 145, exp: 416000000000000,  tier: 30, title: { ko: '무명',            en: 'The Unnamed'          }, icon: '⬜', color: '#ffffff' },
  { level: 146, exp: 518000000000000,  tier: 30, title: { ko: '기록 밖의 존재',  en: 'Off the Record'       }, icon: '🚫', color: '#ffffff' },
  { level: 147, exp: 645000000000000,  tier: 30, title: { ko: '부를 수 없는 것', en: 'Uncallable'           }, icon: '🔕', color: '#ffffff' },
  { level: 148, exp: 803000000000000,  tier: 30, title: { ko: '마지막 한 걸음',  en: 'Final Step'           }, icon: '👣', color: '#ffffff' },
  { level: 149, exp: 999999999999999,  tier: 30, title: { ko: '이름 없는 것',    en: 'The Nameless'         }, icon: '✴️', color: '#ffffff' },
];

const TIER_INFO = {
  1:  { name: { ko: '입문',          en: 'Beginner'       }, color: '#888' },
  2:  { name: { ko: '초보',          en: 'Novice'         }, color: '#daa520' },
  3:  { name: { ko: '중급',          en: 'Intermediate'   }, color: '#ff6b1a' },
  4:  { name: { ko: '상급',          en: 'Advanced'       }, color: '#4a9aff' },
  5:  { name: { ko: '엘리트',        en: 'Elite'          }, color: '#c0a0ff' },
  6:  { name: { ko: '전설',          en: 'Legend'         }, color: '#ffd700' },
  7:  { name: { ko: '불멸',          en: 'Immortal'       }, color: '#ff44ff' },
  8:  { name: { ko: '신화',          en: 'Myth'           }, color: '#ff2222' },
  9:  { name: { ko: '초월',          en: 'Transcend'      }, color: '#00ffcc' },
  10: { name: { ko: '정점',          en: 'Apex'           }, color: '#ff0066' },
  11: { name: { ko: '각성',          en: 'Awakened'       }, color: '#a0ff40' },
  12: { name: { ko: '초인',          en: 'Superhuman'     }, color: '#40ffa0' },
  13: { name: { ko: '반신',          en: 'Demigod'        }, color: '#40e0ff' },
  14: { name: { ko: '신격',          en: 'Divine'         }, color: '#8080ff' },
  15: { name: { ko: '창조',          en: 'Creator'        }, color: '#c060ff' },
  16: { name: { ko: '무한',          en: 'Infinite'       }, color: '#ff60c0' },
  17: { name: { ko: '차원',          en: 'Dimension'      }, color: '#ff6060' },
  18: { name: { ko: '우주',          en: 'Cosmos'         }, color: '#ffa040' },
  19: { name: { ko: '특이점',        en: 'Singularity'    }, color: '#ffe040' },
  20: { name: { ko: '절대',          en: 'Absolute'       }, color: '#dfe6ee' },
  21: { name: { ko: '근원',          en: 'Origin'         }, color: '#7de0d0' },
  22: { name: { ko: '섭리',          en: 'Providence'     }, color: '#9fd8ff' },
  23: { name: { ko: '무형',          en: 'Formless'       }, color: '#b9b9ff' },
  24: { name: { ko: '편재',          en: 'Omnipresence'   }, color: '#d0a8ff' },
  25: { name: { ko: '불가해',        en: 'Ineffable'      }, color: '#ff9de0' },
  26: { name: { ko: '초개념',        en: 'Metaconcept'    }, color: '#ff8f8f' },
  27: { name: { ko: '원환',          en: 'Ouroboros'      }, color: '#ffb066' },
  28: { name: { ko: '침묵',          en: 'Silence'        }, color: '#ffd98a' },
  29: { name: { ko: '백지',          en: 'Blank'          }, color: '#ececec' },
  30: { name: { ko: '이름 없는 것',  en: 'Nameless'       }, color: '#ffffff' },
};

const T = {
  ko: {
    nextLevel: '다음 레벨까지',
    maxLevel: 'MAX LEVEL',
    next: '다음',
    exp: 'EXP',
    allLevels: '전체 레벨 보기',
    closeLevels: '접기',
    current: '현재',
    trTable: '초월 등급표',
    trPerLevel: '초월 1레벨당',
    gnTable: '개벽 등급표',
    gnPerLevel: '개벽 1레벨당',
    ulHeld: '보유',
    ulRule: '울트라 레전드 EXP 는 울트라 레전드 파칭코에서만 나옵니다. 남는 티켓을 교환소에서 울트라 티켓으로 바꿔 돌리세요.',
    required: '필요 EXP',
    tier: '티어',
    nextTier: '다음 티어까지',
  },
  en: {
    nextLevel: 'Next level in',
    maxLevel: 'MAX LEVEL',
    next: 'Next',
    exp: 'EXP',
    allLevels: 'View All Levels',
    closeLevels: 'Close',
    current: 'Current',
    trTable: 'Transcend Tiers',
    trPerLevel: 'Per transcend level',
    gnTable: 'Genesis Tiers',
    gnPerLevel: 'Per genesis level',
    ulHeld: 'Held',
    ulRule: 'ULTRA LEGEND EXP comes only from the Ultra Legend Pachinko. Trade spare tickets at the Exchange to play it.',
    required: 'Required EXP',
    tier: 'TIER',
    nextTier: 'Next tier in',
  },
};

// EXP 공식 1.5배 상향: 운동 ×10 → ×15, 인바디 ×20 → ×30
// LV 149 도달 EXP — 여기부터 초월 등급이 시작된다.
// 이 위로는 일반 레벨이 없고, 넘기면 JS 정수 정밀도(2^53)가 깨진다
export const TABLE_MAX_EXP = LEVEL_TABLE[LEVEL_TABLE.length - 1].exp;

// ══ 초월 등급 ══
// 일반 레벨(0~149)을 다 채우면 그 위로 열리는 별도 체계.
// 레벨 구간이 아니라 고정 비용으로 오른다.
export const TRANSCEND = {
  expPerLevel: 80000000000000,   // 초월 1레벨당 80조 EXP
  maxLevel: 100,                 // 초월 만렙
  name: { ko: '초월', en: 'Transcend' },
  color: '#ffffff',
  icon: '🔆',
};

// 누적 EXP 상한 — 초월 만렙 도달점.
// 2^53(9,007,199,254,740,991) 안쪽이라 정수 정밀도가 깨지지 않는다.
export const MAX_EXP = TABLE_MAX_EXP + TRANSCEND.expPerLevel * TRANSCEND.maxLevel;

// 초월 100레벨을 10등급으로 나눈다 (등급당 10레벨, 마지막만 11)
export const TRANSCEND_TIERS = [
  { from: 0,  to: 9,   name: { ko: '여명', en: 'Dawn' },          icon: '🌅', color: '#a0ffd0' },
  { from: 10, to: 19,  name: { ko: '성좌', en: 'Constellation' }, icon: '✨', color: '#a0d0ff' },
  { from: 20, to: 29,  name: { ko: '심연', en: 'Abyss' },         icon: '🌊', color: '#8080ff' },
  { from: 30, to: 39,  name: { ko: '균열', en: 'Rift' },          icon: '🌀', color: '#c060ff' },
  { from: 40, to: 49,  name: { ko: '공허', en: 'Void' },          icon: '⬛', color: '#8060c0' },
  { from: 50, to: 59,  name: { ko: '영겁', en: 'Eon' },           icon: '⏳', color: '#ffb060' },
  { from: 60, to: 69,  name: { ko: '창천', en: 'Empyrean' },      icon: '🌌', color: '#60d0ff' },
  { from: 70, to: 79,  name: { ko: '태초', en: 'Primordial' },    icon: '🔥', color: '#ffd060' },
  { from: 80, to: 89,  name: { ko: '종말', en: 'Omega' },         icon: '💀', color: '#ff6060' },
  { from: 90, to: 100, name: { ko: '무극', en: 'Boundless' },     icon: '👁️', color: '#ffffff' },
];

export function getTranscendTier(level) {
  return TRANSCEND_TIERS.find(tier => level >= tier.from && level <= tier.to) || TRANSCEND_TIERS[0];
}

// 초월 등급 정보. 아직 LV 149가 아니면 null.
export function getTranscendInfo(exp) {
  if (exp < TABLE_MAX_EXP) return null;
  const over = exp - TABLE_MAX_EXP;
  const level = Math.min(Math.floor(over / TRANSCEND.expPerLevel), TRANSCEND.maxLevel);
  const maxed = level >= TRANSCEND.maxLevel;
  const into = maxed ? TRANSCEND.expPerLevel : over % TRANSCEND.expPerLevel;
  return {
    level,
    into,
    need: TRANSCEND.expPerLevel,
    progress: (into / TRANSCEND.expPerLevel) * 100,
    maxed,
    tier: getTranscendTier(level),
  };
}

// ══ 울트라 레전드 EXP ══
// 일반 EXP 와는 별개인 두 번째 화폐. 규칙은 한 줄이다 —
// **울트라 레전드 파칭코에서만 나온다.** 개벽 등급은 이 값으로만 오른다.
//
// 화폐를 나눈 건 취향이 아니라 필요다. 일반 150레벨 + 초월 100레벨이 이미 2^53 을
// 거의 다 쓴다 (MAX_EXP = 8,999조, 2^53 = 9,007조). 한 숫자로 계속 세면 끝자리가
// 뭉개지므로, 상한 위쪽은 아예 다른 값에 담는다 (LS.ulExp).
//
// 한때는 "누적 EXP 상한을 넘겨 버려지던 몫"을 여기로 넘겼는데, 그건 전용 기계가
// 없던 시절의 임시 통로였다. 지금은 남는 티켓을 교환소에서 울트라 티켓으로 바꿔
// 그 기계를 돌리는 것이 정해진 경로다.
export const UL_EXP = {
  name:  { ko: '울트라 레전드 EXP', en: 'ULTRA LEGEND EXP' },
  short: { ko: 'UL EXP',            en: 'UL EXP' },
  color: '#ff5ce0',
  icon: '⚡',
};

// ══ 개벽 등급 ══
// 초월(0~100)을 다 채우면 그 위로 열리는 3차 체계. 다시 0부터 시작하고,
// 일반 EXP 가 아니라 울트라 레전드 EXP 로 오른다.
// 100 → 250 레벨로 늘렸다. 1레벨당 비용도 같이 내려야 한다:
//
//   80조 × 250 = 20,000조  →  2^53(9,007조)을 넘어 정수 정밀도가 깨진다
//   36조 × 250 =  9,000조  →  들어가긴 하나 여유가 7조뿐이라 위험하다
//   32조 × 250 =  8,000조  →  여유 1,007조. 누적 상한이 예전과 똑같아진다  ← 이걸 쓴다
//
// 울트라 파칭코 보상은 이 값의 배수(pachinkoData 의 L)로 잡혀 있어 같이 줄어든다.
// 그래서 "한 판에 몇 레벨" 은 그대로고, 250레벨을 다 오르는 데 드는 판 수만 2.5배가 된다.
// 레벨을 늘린다는 건 그만큼 더 오래 오른다는 뜻이므로 이게 맞는 방향이다.
//
// 이미 UL EXP 를 모아둔 계정은 EXP 가 그대로인 채 레벨 표시만 2.5배가 된다
// (개벽 40 → 100). 잃는 건 없고, 앞으로 판당 오르는 레벨도 예전과 같다.
export const GENESIS = {
  expPerLevel: 32000000000000,   // 개벽 1레벨당 32조 UL EXP
  maxLevel: 250,
  name: { ko: '개벽', en: 'Genesis' },
  color: '#ffe9a8',
  icon: '🌑',
};

// UL EXP 누적의 상한. 이 값도 2^53 안쪽이어야 한다 (32조 × 250 = 8,000조).
export const MAX_UL_EXP = GENESIS.expPerLevel * GENESIS.maxLevel;

// 개벽 250레벨을 25등급으로 나눈다 (등급당 10레벨, 마지막만 11).
// 이름은 초월 등급(여명·성좌·심연·균열·공허·영겁·창천·태초·종말·무극)과 겹치지 않게 골랐다.
//
// 0~99 는 원래대로 두고 100 위로 15등급을 더 얹었다. '하나'(모든 것이 하나)에서
// 끝났던 자리라, 그 위는 하나마저 지워지는 쪽으로 간다 — 무(없음) → 현(가물함) →
// 태허 → 불이 → 진여 … → 무위(함이 없음). 다 오르면 이름조차 남지 않는다.
export const GENESIS_TIERS = [
  { from: 0,   to: 9,   name: { ko: '혼돈', en: 'Chaos' },       icon: '🌫️', color: '#7a7a8c' },
  { from: 10,  to: 19,  name: { ko: '태동', en: 'Stirring' },    icon: '🌋', color: '#c86a3a' },
  { from: 20,  to: 29,  name: { ko: '천지', en: 'Firmament' },   icon: '⛰️', color: '#8fae6a' },
  { from: 30,  to: 39,  name: { ko: '만상', en: 'Myriad' },      icon: '🌿', color: '#4fc98a' },
  { from: 40,  to: 49,  name: { ko: '윤회', en: 'Samsara' },     icon: '☸️', color: '#4fa8d8' },
  { from: 50,  to: 59,  name: { ko: '적멸', en: 'Nirvana' },     icon: '🕯️', color: '#9a7ad8' },
  { from: 60,  to: 69,  name: { ko: '진리', en: 'Truth' },       icon: '📜', color: '#d8b84f' },
  { from: 70,  to: 79,  name: { ko: '도',   en: 'The Way' },     icon: '🎋', color: '#6ad8c0' },
  { from: 80,  to: 89,  name: { ko: '창조', en: 'Creation' },    icon: '🖐️', color: '#ff9a4f' },
  { from: 90,  to: 99,  name: { ko: '하나', en: 'The One' },     icon: '⚪', color: '#ffffff' },
  // ── 여기부터 이번에 늘린 구간 ──
  { from: 100, to: 109, name: { ko: '무',   en: 'Nothing' },     icon: '🕳️', color: '#5e5e6e' },
  { from: 110, to: 119, name: { ko: '현',   en: 'Mystery' },     icon: '🌘', color: '#7b6bd8' },
  { from: 120, to: 129, name: { ko: '태허', en: 'Great Void' },  icon: '🫧', color: '#6fb7d8' },
  { from: 130, to: 139, name: { ko: '불이', en: 'Nondual' },     icon: '☯️', color: '#c9c9d8' },
  { from: 140, to: 149, name: { ko: '진여', en: 'Suchness' },    icon: '🔷', color: '#4fd8c9' },
  { from: 150, to: 159, name: { ko: '법계', en: 'Dharma Realm' },icon: '🕸️', color: '#a8d84f' },
  { from: 160, to: 169, name: { ko: '화엄', en: 'Flower Realm' },icon: '🪷', color: '#ff7ab8' },
  { from: 170, to: 179, name: { ko: '원융', en: 'Interfusion' }, icon: '⭕', color: '#ffb84f' },
  { from: 180, to: 189, name: { ko: '무량', en: 'Immeasurable' },icon: '🌠', color: '#6a8cff' },
  { from: 190, to: 199, name: { ko: '겁외', en: 'Beyond Kalpa' },icon: '🕰️', color: '#d89a4f' },
  { from: 200, to: 209, name: { ko: '적광', en: 'Still Light' }, icon: '🔅', color: '#ffe066' },
  { from: 210, to: 219, name: { ko: '상주', en: 'Everlasting' }, icon: '🗿', color: '#9aa0a6' },
  { from: 220, to: 229, name: { ko: '묘각', en: 'Wondrous' },    icon: '🧿', color: '#4fa8ff' },
  { from: 230, to: 239, name: { ko: '대원', en: 'Great Perfection' },  icon: '🌕', color: '#ff5ce0' },
  { from: 240, to: 250, name: { ko: '무위', en: 'Unconditioned' },icon: '🕊️', color: '#ffe9a8' },
];

export function getGenesisTier(level) {
  return GENESIS_TIERS.find(tier => level >= tier.from && level <= tier.to) || GENESIS_TIERS[0];
}

// 개벽 등급 정보. 초월이 만렙이 아니면 null — 초월을 다 채워야 열린다.
export function getGenesisInfo(exp, ulExp = 0) {
  const tr = getTranscendInfo(exp);
  if (!tr || !tr.maxed) return null;
  const capped = Math.min(Math.max(Number(ulExp) || 0, 0), MAX_UL_EXP);
  const level = Math.min(Math.floor(capped / GENESIS.expPerLevel), GENESIS.maxLevel);
  const maxed = level >= GENESIS.maxLevel;
  const into = maxed ? GENESIS.expPerLevel : capped % GENESIS.expPerLevel;
  return {
    level,
    into,
    need: GENESIS.expPerLevel,
    progress: (into / GENESIS.expPerLevel) * 100,
    maxed,
    tier: getGenesisTier(level),
  };
}

// 해당 레벨에 막 도달하는 누적 EXP. 범위를 벗어나면 양끝으로 자른다.
export function expForLevel(level) {
  const first = LEVEL_TABLE[0], last = LEVEL_TABLE[LEVEL_TABLE.length - 1];
  if (level <= first.level) return first.exp;
  if (level >= last.level) return last.exp;
  return (LEVEL_TABLE.find(l => l.level === level) || first).exp;
}

export const MAX_LEVEL = LEVEL_TABLE[LEVEL_TABLE.length - 1].level;

// 기록 하나가 주는 EXP. 고객센터 FAQ 가 이 값을 읽어 문장으로 푼다 —
// 밸런스를 바꾸면 설명이 저절로 따라온다
export const EXP_PER = { workout: 15, inbody: 30 };

export function calcExp(totalWorkouts, totalInbody, bonusExp = 0) {
  const total = (totalWorkouts * EXP_PER.workout) + (totalInbody * EXP_PER.inbody) + bonusExp;
  return Math.min(total, MAX_EXP);
}

export function getLevelInfo(exp) {
  let current = LEVEL_TABLE[0];
  for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
    if (exp >= LEVEL_TABLE[i].exp) {
      current = LEVEL_TABLE[i];
      break;
    }
  }
  const nextIdx = LEVEL_TABLE.findIndex(l => l.level === current.level) + 1;
  const next = nextIdx < LEVEL_TABLE.length ? LEVEL_TABLE[nextIdx] : null;
  const currentExp = exp - current.exp;
  const needExp = next ? next.exp - current.exp : 0;
  const progress = next ? Math.min((currentExp / needExp) * 100, 100) : 100;

  // 티어 정보 + 다음 티어 진입 레벨 찾기
  const tierInfo = TIER_INFO[current.tier];
  const nextTierEntry = LEVEL_TABLE.find(l => l.tier === current.tier + 1);
  const nextTierInfo = nextTierEntry ? TIER_INFO[nextTierEntry.tier] : null;
  const expToNextTier = nextTierEntry ? nextTierEntry.exp - exp : 0;

  return {
    ...current,
    exp: currentExp,
    needExp,
    progress,
    totalExp: exp,
    next,
    tierInfo,
    nextTierInfo,
    nextTierEntry,
    expToNextTier,
  };
}

export default function LevelSystem({ totalWorkouts, totalInbody, bonusExp = 0, ulExp = 0 }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;
  const [showAll, setShowAll] = useState(false);
  const [showTrTiers, setShowTrTiers] = useState(false);
  const [showGnTiers, setShowGnTiers] = useState(false);

  const exp = calcExp(totalWorkouts, totalInbody, bonusExp);
  const info = getLevelInfo(exp);
  // LV 149를 채우면 그 위로 초월 등급이 열린다
  const tr = getTranscendInfo(exp);
  // 초월 100을 다 채우면 그 위로 개벽이 열린다. 누적 EXP 상한을 넘어 버려지던 초과분으로 센다
  const gn = getGenesisInfo(exp, ulExp);

  // 현재 티어 안에서의 레벨 진행도 (5레벨 중 몇 번째).
  // 레벨이 0부터라 Tₙ의 시작 레벨은 (n-1)*5 다. +1 을 붙이면 전 티어가 0/5 부터 시작한다.
  const tierStartLevel = (info.tier - 1) * 5;
  const tierLevelIdx = info.level - tierStartLevel + 1;

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      {/* 상단: 티어 칩 + 레벨 표시 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px',
          borderRadius: 'var(--radius)',
          background: `${info.tierInfo.color}18`,
          border: `1px solid ${info.tierInfo.color}66`,
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 11, letterSpacing: 1.5,
          color: info.tierInfo.color,
        }}>
          <span>{t.tier}</span>
          <span style={{ fontWeight: 700 }}>
            {info.tierInfo.name[lang] || info.tierInfo.name.ko}
          </span>
          <span style={{ fontSize: 9, opacity: 0.6 }}>
            {tierLevelIdx}/5
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          fontFamily: "'Bebas Neue', sans-serif",
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>LV</span>
          <span style={{
            fontSize: 26, fontWeight: 700, color: info.color, letterSpacing: 1,
            textShadow: `0 0 12px ${info.color}40`,
          }}>
            {info.level}
          </span>
        </div>
      </div>

      {/* 초월 등급 — LV 149를 채운 뒤부터 표시 */}
      {tr && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginBottom: 12, padding: '8px 12px',
          borderRadius: 'var(--radius)',
          background: `${tr.tier.color}0e`,
          border: `1px solid ${tr.tier.color}55`,
          boxShadow: `0 0 24px ${tr.tier.color}22 inset`,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontSize: 15 }}>{tr.tier.icon}</span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: 2,
              color: 'var(--text-muted)',
            }}>
              {TRANSCEND.name[lang] || TRANSCEND.name.ko}
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1,
              color: tr.tier.color,
            }}>
              {tr.tier.name[lang] || tr.tier.name.ko}
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, lineHeight: 1,
              color: tr.tier.color,
              textShadow: `0 0 14px ${tr.tier.color}aa`,
            }}>
              {tr.level}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              / {TRANSCEND.maxLevel}
            </span>
          </div>

          <div style={{ flex: 1, maxWidth: 160 }}>
            <div style={{
              height: 4, borderRadius: 2,
              background: 'var(--bg-tertiary)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${tr.progress}%`, height: '100%',
                background: tr.tier.color,
                boxShadow: `0 0 8px ${tr.tier.color}`,
                transition: 'width 400ms ease',
              }} />
            </div>
            <div style={{
              fontSize: 9, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right',
            }}>
              {tr.maxed
                ? t.maxLevel
                : `${(tr.need - tr.into).toLocaleString()} ${t.exp}`}
            </div>
          </div>
        </div>
      )}

      {/* 초월 등급표 */}
      {tr && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setShowTrTiers(v => !v)}
            style={{
              width: '100%', background: 'none',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--text-muted)', fontSize: 11, padding: '6px 0', cursor: 'pointer',
            }}
          >
            {showTrTiers ? t.closeLevels : `🔆 ${t.trTable}`}
          </button>

          {showTrTiers && (
            <div style={{ marginTop: 8 }}>
              {TRANSCEND_TIERS.map(tier => {
                const isCurrent = tr.level >= tier.from && tr.level <= tier.to;
                const cleared = tr.level > tier.to;
                return (
                  <div
                    key={tier.from}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 8px', marginBottom: 3,
                      borderRadius: 'var(--radius)',
                      background: isCurrent ? `${tier.color}1a` : 'transparent',
                      border: `1px solid ${isCurrent ? `${tier.color}88` : 'var(--border)'}`,
                      opacity: cleared || isCurrent ? 1 : 0.45,
                    }}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 12, color: tier.color,
                    }}>
                      <span>{tier.icon}</span>
                      <span style={{ fontWeight: isCurrent ? 700 : 400 }}>
                        {tier.name[lang] || tier.name.ko}
                      </span>
                      {isCurrent && (
                        <span style={{
                          padding: '0 5px', borderRadius: 'var(--radius)',
                          background: `${tier.color}22`, border: `1px solid ${tier.color}66`,
                          fontFamily: "'Bebas Neue', sans-serif", fontSize: 9, letterSpacing: 1,
                        }}>
                          {t.current}
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 11,
                      color: 'var(--text-muted)',
                    }}>
                      {tier.from} ~ {tier.to}
                    </span>
                  </div>
                );
              })}
              <div style={{
                marginTop: 6, fontSize: 10, color: 'var(--text-muted)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{t.trPerLevel}</span>
                <span>{TRANSCEND.expPerLevel.toLocaleString()} {t.exp}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 개벽 등급 — 초월 100을 채운 뒤부터 표시 */}
      {gn && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginBottom: 12, padding: '8px 12px',
          borderRadius: 'var(--radius)',
          background: `${gn.tier.color}0e`,
          border: `1px solid ${gn.tier.color}55`,
          boxShadow: `0 0 24px ${gn.tier.color}22 inset`,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontSize: 15 }}>{gn.tier.icon}</span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: 2,
              color: 'var(--text-muted)',
            }}>
              {GENESIS.name[lang] || GENESIS.name.ko}
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1,
              color: gn.tier.color,
            }}>
              {gn.tier.name[lang] || gn.tier.name.ko}
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, lineHeight: 1,
              color: gn.tier.color,
              textShadow: `0 0 14px ${gn.tier.color}aa`,
            }}>
              {gn.level}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              / {GENESIS.maxLevel}
            </span>
          </div>

          <div style={{ flex: 1, maxWidth: 160 }}>
            <div style={{
              height: 4, borderRadius: 2,
              background: 'var(--bg-tertiary)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${gn.progress}%`, height: '100%',
                background: gn.tier.color,
                boxShadow: `0 0 8px ${gn.tier.color}`,
                transition: 'width 400ms ease',
              }} />
            </div>
            <div style={{
              fontSize: 9, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right',
            }}>
              {gn.maxed
                ? t.maxLevel
                : `${(gn.need - gn.into).toLocaleString()} ${UL_EXP.short[lang] || UL_EXP.short.ko}`}
            </div>
          </div>
        </div>
      )}

      {/* 개벽 등급표 */}
      {gn && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setShowGnTiers(v => !v)}
            style={{
              width: '100%', background: 'none',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--text-muted)', fontSize: 11, padding: '6px 0', cursor: 'pointer',
            }}
          >
            {showGnTiers ? t.closeLevels : `${GENESIS.icon} ${t.gnTable}`}
          </button>

          {showGnTiers && (
            <div style={{ marginTop: 8 }}>
              {GENESIS_TIERS.map(tier => {
                const isCurrent = gn.level >= tier.from && gn.level <= tier.to;
                const cleared = gn.level > tier.to;
                return (
                  <div
                    key={tier.from}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 8px', marginBottom: 3,
                      borderRadius: 'var(--radius)',
                      background: isCurrent ? `${tier.color}1a` : 'transparent',
                      border: `1px solid ${isCurrent ? `${tier.color}88` : 'var(--border)'}`,
                      opacity: cleared || isCurrent ? 1 : 0.45,
                    }}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 12, color: tier.color,
                    }}>
                      <span>{tier.icon}</span>
                      <span style={{ fontWeight: isCurrent ? 700 : 400 }}>
                        {tier.name[lang] || tier.name.ko}
                      </span>
                      {isCurrent && (
                        <span style={{
                          padding: '0 5px', borderRadius: 'var(--radius)',
                          background: `${tier.color}22`, border: `1px solid ${tier.color}66`,
                          fontFamily: "'Bebas Neue', sans-serif", fontSize: 9, letterSpacing: 1,
                        }}>
                          {t.current}
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 11,
                      color: 'var(--text-muted)',
                    }}>
                      {tier.from} ~ {tier.to}
                    </span>
                  </div>
                );
              })}
              <div style={{
                marginTop: 6, fontSize: 10, color: 'var(--text-muted)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{t.gnPerLevel}</span>
                <span>
                  {GENESIS.expPerLevel.toLocaleString()}{' '}
                  <span style={{ color: UL_EXP.color }}>{UL_EXP.short[lang] || UL_EXP.short.ko}</span>
                </span>
              </div>
              <div style={{
                marginTop: 3, fontSize: 10, color: 'var(--text-muted)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{t.ulHeld} {UL_EXP.icon} {UL_EXP.name[lang] || UL_EXP.name.ko}</span>
                <span style={{ color: UL_EXP.color }}>
                  {Math.min(Math.max(Number(ulExp) || 0, 0), MAX_UL_EXP).toLocaleString()}
                </span>
              </div>
              <div style={{
                marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)',
                fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6,
              }}>
                {UL_EXP.icon} {t.ulRule}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 메인: 아이콘 + 칭호 + EXP 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `radial-gradient(circle, ${info.color}25 0%, ${info.color}08 70%)`,
          border: `2px solid ${info.color}`,
          fontSize: 26,
          boxShadow: `0 0 16px ${info.color}40, inset 0 0 8px ${info.color}20`,
        }}>
          {info.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: info.color, marginBottom: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {info.title[lang] || info.title.ko}
          </div>

          {/* EXP 바 */}
          <div style={{ marginBottom: 4 }}>
            <div style={{
              height: 10, borderRadius: 5,
              background: 'var(--bg-tertiary)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                height: '100%', borderRadius: 5,
                width: `${info.progress}%`,
                background: `linear-gradient(90deg, ${info.color}, ${info.color}cc)`,
                transition: 'width 0.6s ease',
                boxShadow: `0 0 8px ${info.color}80`,
              }} />
            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            <span>{t.exp} {info.totalExp.toLocaleString()}</span>
            {info.next ? (
              <span>{t.nextLevel} {(info.needExp - info.exp).toLocaleString()} {t.exp}</span>
            ) : (
              <span style={{ color: info.color, fontWeight: 700 }}>{t.maxLevel}</span>
            )}
          </div>
        </div>
      </div>

      {/* 하단: 다음 레벨 + 다음 티어 미리보기 */}
      {info.next && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
            color: 'var(--text-muted)',
          }}>
            <span>{t.next}:</span>
            <span style={{ fontSize: 14 }}>{info.next.icon}</span>
            <span style={{ color: info.next.color, fontWeight: 600 }}>
              LV.{info.next.level} {info.next.title[lang] || info.next.title.ko}
            </span>
          </div>
          {info.nextTierInfo && info.nextTierEntry && (
            <div style={{
              fontSize: 10, color: 'var(--text-muted)',
              padding: '2px 8px', borderRadius: 'var(--radius)',
              background: `${info.nextTierInfo.color}10`,
              border: `1px solid ${info.nextTierInfo.color}40`,
            }}>
              <span style={{ color: info.nextTierInfo.color, fontWeight: 700 }}>
                {info.nextTierInfo.name[lang] || info.nextTierInfo.name.ko}
              </span>
              <span> · {t.nextTier} {info.expToNextTier.toLocaleString()} {t.exp}</span>
            </div>
          )}
        </div>
      )}

      {/* 전체 레벨 보기 */}
      <div style={{ marginTop: 10, textAlign: 'center' }}>
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '4px 14px', fontSize: 11, borderRadius: 'var(--radius)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {showAll ? t.closeLevels : t.allLevels}
        </button>
      </div>

      {showAll && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {Object.values(TIER_INFO).map((tier, tIdx) => {
            const tierNum = tIdx + 1;
            const tierLevels = LEVEL_TABLE.filter(l => l.tier === tierNum);
            return (
              <div key={tierNum} style={{ marginBottom: 12 }}>
                {/* 티어 헤더 */}
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: 2,
                  color: tier.color, marginBottom: 6,
                  paddingBottom: 4, borderBottom: `1px solid ${tier.color}30`,
                }}>
                  T{tierNum} · {tier.name[lang] || tier.name.ko}
                </div>
                {tierLevels.map(lv => {
                  const isCurrent = lv.level === info.level;
                  return (
                    <div key={lv.level} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 6px',
                      borderRadius: 'var(--radius)',
                      background: isCurrent ? `${lv.color}14` : 'none',
                      borderLeft: isCurrent ? `3px solid ${lv.color}` : '3px solid transparent',
                      marginBottom: 1,
                    }}>
                      <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{lv.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, letterSpacing: 1,
                            color: lv.color,
                          }}>
                            LV.{lv.level}
                          </span>
                          <span style={{
                            fontSize: 12, fontWeight: isCurrent ? 700 : 400,
                            color: isCurrent ? lv.color : 'var(--text-secondary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {lv.title[lang] || lv.title.ko}
                          </span>
                          {isCurrent && (
                            <span style={{
                              fontSize: 9, padding: '1px 6px', borderRadius: 'var(--radius)',
                              background: lv.color, color: '#000', fontWeight: 700,
                            }}>
                              {t.current}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                          {t.required}: {lv.exp.toLocaleString()} {t.exp}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
