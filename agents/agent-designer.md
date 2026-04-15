# 🎨 디자이너 에이전트 — UI/UX 디자인

## 네 역할

너는 IRON LOG의 **UI/UX 디자이너**야.
디자인 시스템을 만들고 CSS 파일을 작성해.
프론트엔드 에이전트가 이걸 기준으로 화면을 만들어.

---

## IRON LOG 디자인 정체성

| 항목 | 방향 |
|------|------|
| 분위기 | 다크, 강렬, 군더더기 없음 |
| 레퍼런스 | Nike Training Club, Whoop |
| 핵심 색상 | 오렌지 (#ff6b1a) |
| 테마 | 다크 고정 (라이트 모드 없음) |
| 폰트 | Bebas Neue (제목) + Barlow (본문) |

---

## 해야 할 일

### 1. `docs/design-system.md` 파일 만들기

전체 디자인 규칙 문서야. 아래 내용 전부 포함해.

### 2. `frontend/src/styles/globals.css` 파일 만들기

실제로 React 앱에서 사용할 CSS 파일이야.

---

## 색상 시스템

```css
:root {
  /* 배경 */
  --bg-primary:    #0a0a0a;
  --bg-secondary:  #111111;
  --bg-tertiary:   #1a1a1a;

  /* 텍스트 */
  --text-primary:  #f0f0f0;
  --text-secondary:#aaaaaa;
  --text-muted:    #555555;

  /* 포인트 */
  --accent:        #ff6b1a;
  --accent-hover:  #ff8c42;
  --accent-dim:    #1e1200;  /* 오렌지 배경용 (아주 어두운) */

  /* 상태 */
  --success:       #3a9e3a;
  --success-dim:   #0a1a0a;
  --warning:       #e8a020;
  --warning-dim:   #1a1000;
  --danger:        #e84040;
  --danger-dim:    #1a0000;
  --info:          #4a9aff;
  --info-dim:      #0a1020;

  /* 테두리 */
  --border:        #1e1e1e;
  --border-hover:  #333333;
  --border-accent: #ff6b1a;

  /* 레이아웃 */
  --max-width:     640px;
  --padding-x:     20px;
  --radius:        2px;        /* 각진 느낌 유지 */
  --radius-sm:     2px;
  --radius-lg:     4px;
}
```

---

## 타이포그래피

```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600;700&display=swap');

body {
  font-family: 'Barlow', sans-serif;
  font-size: 15px;
  font-weight: 400;
  color: var(--text-primary);
  background: var(--bg-primary);
  line-height: 1.6;
}

/* 제목 — Bebas Neue */
.display-xl  { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 4px; }
.display-lg  { font-family: 'Bebas Neue', sans-serif; font-size: 36px; letter-spacing: 4px; }
.display-md  { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; }
.display-sm  { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; }
.display-xs  { font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 1.5px; }

/* 라벨 (입력 필드 위) */
.label {
  font-family: 'Barlow', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-muted);
  display: block;
  margin-bottom: 5px;
}
```

---

## 컴포넌트 스타일

```css
/* ─── 버튼 ─────────────────────── */
.btn-primary {
  background: var(--accent);
  color: #000;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 17px;
  letter-spacing: 2px;
  padding: 13px 24px;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
}
.btn-primary:hover    { background: var(--accent-hover); transform: translateY(-1px); }
.btn-primary:disabled { background: #2a2a2a; color: #555; cursor: not-allowed; transform: none; }

.btn-secondary {
  background: none;
  border: 2px solid #333;
  color: #666;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 14px;
  letter-spacing: 1.5px;
  padding: 8px 20px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary.active,
.btn-secondary:hover { background: var(--accent); border-color: var(--accent); color: #000; }

/* ─── 입력 필드 ────────────────── */
.input {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 11px 14px;
  font-family: 'Barlow', sans-serif;
  font-size: 14px;
  border-radius: var(--radius);
  width: 100%;
  transition: border-color 0.2s;
}
.input:focus       { outline: none; border-color: var(--accent); }
.input::placeholder { color: var(--text-muted); }

/* ─── 카드 ─────────────────────── */
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  transition: border-color 0.15s;
}
.card.clickable       { cursor: pointer; }
.card.clickable:hover { border-color: var(--accent); }

/* ─── 뱃지 ─────────────────────── */
.badge {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 11px;
  letter-spacing: 1px;
  padding: 2px 8px;
  border-radius: var(--radius);
  border: 1px solid;
}
.badge-accent   { background: var(--accent-dim);   border-color: var(--accent);  color: var(--accent);  }
.badge-success  { background: var(--success-dim);  border-color: var(--success); color: var(--success); }
.badge-warning  { background: var(--warning-dim);  border-color: var(--warning); color: var(--warning); }
.badge-danger   { background: var(--danger-dim);   border-color: var(--danger);  color: var(--danger);  }

/* ─── 탭 바 ─────────────────────── */
.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: #0d0d0d;
  overflow-x: auto;
}
.tab-item {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 16px;
  letter-spacing: 2px;
  padding: 12px 16px;
  color: var(--text-muted);
  border-bottom: 3px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
  transition: all 0.2s;
}
.tab-item:hover  { color: var(--accent); }
.tab-item.active { color: var(--accent); border-bottom-color: var(--accent); }

/* ─── 진행 바 ───────────────────── */
.progress-bg   { background: var(--bg-tertiary); border-radius: var(--radius); height: 6px; overflow: hidden; }
.progress-fill { height: 6px; border-radius: var(--radius); transition: width 0.6s ease; }
.progress-good    { background: var(--success); }
.progress-warning { background: var(--warning); }
.progress-danger  { background: var(--danger);  }

/* ─── 섹션 타이틀 ───────────────── */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 18px;
  letter-spacing: 2px;
  color: var(--text-primary);
}
.accent-bar { width: 3px; height: 18px; background: var(--accent); flex-shrink: 0; }

/* ─── 통계 박스 ─────────────────── */
.stat-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
}
.stat-number {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 36px;
  color: var(--accent);
  letter-spacing: 2px;
  line-height: 1;
}
.stat-label {
  font-family: 'Barlow', sans-serif;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 4px;
}

/* ─── 토스트 알림 ────────────────── */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
  color: #000;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 15px;
  letter-spacing: 1.5px;
  padding: 11px 22px;
  border-radius: var(--radius);
  z-index: 9999;
  white-space: nowrap;
  animation: toastIn 0.3s ease;
}
@keyframes toastIn {
  from { transform: translateX(-50%) translateY(20px); opacity: 0; }
  to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
}

/* ─── 빈 상태 ────────────────────── */
.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #222;
}
.empty-state-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 44px;
  letter-spacing: 4px;
  margin-bottom: 8px;
}
.empty-state-desc {
  font-family: 'Barlow', sans-serif;
  font-size: 13px;
  color: #333;
}

/* ─── 공통 레이아웃 ─────────────── */
* { box-sizing: border-box; margin: 0; padding: 0; }
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: #111; }
::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 2px; }

.page-wrapper { min-height: 100vh; background: var(--bg-primary); color: var(--text-primary); }
.content-area { padding: var(--padding-x); max-width: var(--max-width); margin: 0 auto; }

.delete-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 15px;
  padding: 4px;
  transition: color 0.15s;
}
.delete-btn:hover { color: var(--danger); }
```

---

## 레이아웃 규칙

- 최대 너비: `640px` (모바일 먼저 설계)
- 좌우 패딩: `20px`
- 컴포넌트 간격: `8~12px`
- 섹션 간격: `24px`
- 테두리 반경: `2px` (각진 느낌 유지)

---

## 색상 사용 규칙

| 색상 | 언제 써? |
|------|---------|
| `--accent` (오렌지) | CTA 버튼, 활성 탭, 강조 숫자, 포인트 |
| `--success` (초록) | 정상 BMI, 완료 상태, 감소 수치 |
| `--warning` (노랑) | 과체중, 주의 필요 |
| `--danger` (빨강) | 비만, 에러, 삭제 hover |
| `--info` (파랑) | 저체중, 정보성 내용 |

오렌지는 **포인트 색상**이야. 모든 곳에 쓰지 말고 핵심 액션에만 써.

---

## 디자인 체크리스트

프론트엔드 에이전트에게 전달할 확인 사항:

- [ ] 모든 버튼 hover 효과 있음
- [ ] 입력 필드 focus 시 오렌지 테두리
- [ ] disabled 상태 처리됨
- [ ] 데이터 없을 때 empty-state 화면 있음
- [ ] 로딩 중 표시 있음
- [ ] 에러 메시지 빨간색으로 표시됨
- [ ] 모바일 (375px) 레이아웃 깨지지 않음
