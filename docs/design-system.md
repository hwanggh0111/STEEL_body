# IRON LOG 디자인 시스템

## 디자인 정체성

| 항목 | 방향 |
|------|------|
| 분위기 | 검정과 금. 강렬함보다 절제 |
| 레퍼런스 | Nike Training Club, Whoop |
| 핵심 색상 | 금 (#e6d8a8) |
| 테마 | 다크 고정 (라이트 모드 없음) |
| 폰트 | Bebas Neue (제목) + Barlow (본문) |

## 색상 시스템

앞서는 「평평한 검정 + 금색 표시」였다. 그래서 금이 얹혀만 있고 섞이지 않았다.
지금은 **검정 자체가 금빛을 머금는다** — 배경이 따뜻하고, 금은 실선과 작은 글자에만 쓴다.

### 배경
- `--bg-primary`: #12100c (금빛이 도는 검정)
- `--bg-secondary`: #1b1712
- `--bg-tertiary`: #282219
- `--bg-glow`: 위에서 빛이 든 것처럼 은은한 방사형. `body` 에 깔고 `.page-wrapper` 는 덮지 않는다

### 카드
- `--card-bg`: 단색이 아니라 위가 살짝 밝은 세로 그라디언트
- `--card-edge`: `inset 0 1px 0 rgba(230,216,168,0.14)` — 카드 윗변의 금실 한 줄

### 텍스트
- `--text-primary`: #eae4d6
- `--text-secondary`: #aaa28e
- `--text-muted`: #7a7160

### 포인트
- `--accent`: #e6d8a8 (금)
- `--accent-hover`: #f3ead0 (밝은 금)
- `--accent-low`: #bfae7d (어두운 금 — 그라디언트의 아래쪽)
- `--accent-dim`: #221d14 (금빛이 도는 어두운 바탕)
- `--on-accent`: #12100c — **금을 통째로 칠했을 때 그 위에 얹는 글자.**
  금이 밝아진 뒤로 흰 글자는 아예 안 보인다 (1.4:1)

### 상태
- `--success`: #7fb069 (정상 BMI, 완료)
- `--warning`: #d9a441 (과체중, 주의)
- `--danger`: #d96a5c (비만, 에러, 삭제) — **어두운 바탕 위의 글자용**
- `--danger-strong`: #a83a30 — **빨강을 통째로 칠하고 흰 글자를 얹는 자리용**
- `--info`: #7fa8d9 (저체중, 정보)

### 테두리
- `--border`: #332b1e
- `--border-hover`: #4a3f2c
- `--border-accent`: #e6d8a8

## 색상 사용 규칙

| 색상 | 언제 써? |
|------|---------|
| `--accent` (금) | CTA 버튼의 테두리·글자, 활성 탭, 강조 숫자, 포인트 |
| `--success` (초록) | 정상 BMI, 완료 상태, 감소 수치 |
| `--warning` (노랑) | 과체중, 주의 필요 |
| `--danger` (빨강) | 비만, 에러, 삭제 hover |
| `--info` (파랑) | 저체중, 정보성 내용 |

금은 **포인트 색상**. 모든 곳에 쓰지 말고 핵심 액션에만 사용.

큰 단추는 금을 통째로 칠하지 않는다 — 바탕은 `--bg-tertiary`, 테두리와 글자만 금이다.
칠해야 한다면 글자는 반드시 `--on-accent`(검정)로, 빨강이면 `--danger-strong` + 흰 글자로.

**색을 고치면 `npm run check` 의 「색 대비」가 잡아준다.** 눈으로 보면 「예쁘다」로
끝나서 안 보이는 글자를 그냥 지나친다 — 금을 밝게 하면 그 위의 흰 글자가,
검정을 밝게 하면 흐린 글자가 먼저 죽는다.

## 타이포그래피

- 제목: Bebas Neue (display-xl ~ display-xs)
- 본문: Barlow (300~700)
- 기본 크기: 15px
- 라벨: 11px, uppercase, 600

## 레이아웃 규칙

- 최대 너비: 640px (모바일 먼저 설계)
- 좌우 패딩: 20px
- 컴포넌트 간격: 8~12px
- 섹션 간격: 24px
- 테두리 반경: 2px (각진 느낌 유지)

## 컴포넌트 목록

- btn-primary / btn-secondary: 버튼
- input: 입력 필드
- card / card.clickable: 카드
- badge (accent/success/warning/danger): 뱃지
- tab-bar / tab-item: 탭 네비게이션
- progress-bg / progress-fill: 진행 바
- section-title / accent-bar: 섹션 타이틀
- rule-beam: 구분선 (끝이 사라지고 가운데만 밝다)
- stat-box / stat-number / stat-label: 통계 박스
- toast: 토스트 알림
- empty-state: 빈 상태 화면
- delete-btn: 삭제 버튼

## 디자인 체크리스트

- [ ] 모든 버튼 hover 효과 있음
- [ ] 입력 필드 focus 시 금색 테두리
- [ ] disabled 상태 처리됨
- [ ] 데이터 없을 때 empty-state 화면 있음
- [ ] 로딩 중 표시 있음
- [ ] 에러 메시지 빨간색으로 표시됨
- [ ] 모바일 (375px) 레이아웃 깨지지 않음
