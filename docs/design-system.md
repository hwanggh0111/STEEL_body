# IRON LOG 디자인 시스템

## 디자인 정체성

| 항목 | 방향 |
|------|------|
| 분위기 | 다크, 강렬, 군더더기 없음 |
| 레퍼런스 | Nike Training Club, Whoop |
| 핵심 색상 | 오렌지 (#ff6b1a) |
| 테마 | 다크 고정 (라이트 모드 없음) |
| 폰트 | Bebas Neue (제목) + Barlow (본문) |

## 색상 시스템

### 배경
- `--bg-primary`: #0a0a0a
- `--bg-secondary`: #111111
- `--bg-tertiary`: #1a1a1a

### 텍스트
- `--text-primary`: #f0f0f0
- `--text-secondary`: #aaaaaa
- `--text-muted`: #555555

### 포인트
- `--accent`: #ff6b1a (오렌지)
- `--accent-hover`: #ff8c42
- `--accent-dim`: #1e1200

### 상태
- `--success`: #3a9e3a (정상 BMI, 완료)
- `--warning`: #e8a020 (과체중, 주의)
- `--danger`: #e84040 (비만, 에러, 삭제)
- `--info`: #4a9aff (저체중, 정보)

### 테두리
- `--border`: #1e1e1e
- `--border-hover`: #333333
- `--border-accent`: #ff6b1a

## 색상 사용 규칙

| 색상 | 언제 써? |
|------|---------|
| `--accent` (오렌지) | CTA 버튼, 활성 탭, 강조 숫자, 포인트 |
| `--success` (초록) | 정상 BMI, 완료 상태, 감소 수치 |
| `--warning` (노랑) | 과체중, 주의 필요 |
| `--danger` (빨강) | 비만, 에러, 삭제 hover |
| `--info` (파랑) | 저체중, 정보성 내용 |

오렌지는 **포인트 색상**. 모든 곳에 쓰지 말고 핵심 액션에만 사용.

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
- stat-box / stat-number / stat-label: 통계 박스
- toast: 토스트 알림
- empty-state: 빈 상태 화면
- delete-btn: 삭제 버튼

## 디자인 체크리스트

- [ ] 모든 버튼 hover 효과 있음
- [ ] 입력 필드 focus 시 오렌지 테두리
- [ ] disabled 상태 처리됨
- [ ] 데이터 없을 때 empty-state 화면 있음
- [ ] 로딩 중 표시 있음
- [ ] 에러 메시지 빨간색으로 표시됨
- [ ] 모바일 (375px) 레이아웃 깨지지 않음
