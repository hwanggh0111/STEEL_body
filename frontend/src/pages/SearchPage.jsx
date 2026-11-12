import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ExerciseFinder from '../components/ExerciseFinder';
import { useAuthStore } from '../store/authStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useToday } from '../data/useToday';
import { mineIndex, mineQuery } from '../data/searchMine';
import { agoLabel, shortDate } from '../data/lastSets';
import { daysBetween } from '../data/personalRecord';
import { euroJosa } from '../data/particle';

// ── 내 기록에서 ── (2026-11-12, 시안 1112 C · D — 셈은 `data/searchMine.js`)
//
// **줄 = 기록하기**(이 화면의 일이 그것이다) · 오른쪽 「그날」 = 마지막 날 보기.
// 한 줄짜리로, 많아야 둘 — 자판이 올라와도 사전 결과가 밀려나지 않게(맵시).
// 이름이 갈린 것(D)은 그 줄 바로 밑에 **한 줄**만 붙는다
// 보이는 글은 **kg 를 뺀다** — 폰 폭에서 「최고 34.5kg×10」이 잘렸다(맵시). 낭독기 이름에는 단위를 둔다
const bestText = (b, unit = false) => (!b ? '' : b.kind === 'weighted'
  ? ` · 최고 ${b.kg}${unit ? 'kg' : ''}×${b.reps}${unit ? '회' : ''}` : ` · 최고 ${b.reps}회`);

function MineRows({ rows, today, onRecord, onDay }) {
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="label">내 기록에서</div>
      {rows.map((r) => {
        const ago = agoLabel(daysBetween(r.lastDate, today));
        return (
          <div key={r.name} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="card"
                onClick={() => onRecord(r.name)}
                aria-label={`${r.name} 기록하기 — ${r.days}일 했어요${bestText(r.best, true)}, 마지막 ${ago}`}
                style={{
                  flex: 1, minWidth: 0, minHeight: 44, margin: 0, padding: '10px 12px', textAlign: 'left',
                  cursor: 'pointer', font: 'inherit', color: 'var(--text-secondary)', fontSize: 13,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.name}</b>
                {` · ${r.days}일${bestText(r.best)}`}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onDay(r.lastDate)}
                aria-label={`${r.name} 마지막 날 보기 (${shortDate(r.lastDate)})`}
                style={{ minHeight: 44, minWidth: 56, flexShrink: 0 }}
              >그날</button>
            </div>
            {r.split && (
              <button
                type="button"
                onClick={() => onDay(r.split.lastDate)}
                // 보이는 글이 이미 다 말한다 — `aria-label` 로 덮으면 낭독기는 이름도 「띄어쓰기만
                // 달라요」도 못 듣는다(맵시). 글 그대로 읽힌다
                style={{
                  display: 'block', width: '100%', minHeight: 32, textAlign: 'left', background: 'none',
                  border: 'none', padding: '4px 12px', cursor: 'pointer', font: 'inherit',
                  // 「두 번 세어지고 있다」는 알림이라 흐리면 안 된다 — `--text-muted` 는 카드 위 3.59:1
                  fontSize: 12, color: 'var(--text-secondary)',
                }}
              >
                {r.split.names.length === 1
                  ? `「${r.split.names[0]}」${euroJosa(r.split.names[0])}도 ${r.split.days}일 · 띄어쓰기만 달라요 ›`
                  : `다른 이름 ${r.split.names.length}개로도 ${r.split.days}일 · 띄어쓰기만 달라요 ›`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 운동 검색.
//
// 예전에는 한국어를 치면 그걸 영어로 바꿔서 **외부 DB(wger.de)에 8초를 기다렸다.**
// 그 DB 는 영어 전용이라 대부분 아무것도 안 나왔고, 나와도 영어 이름뿐이라
// 설명이 없었다. 화면에 「최대 8초」라고 적어둔 것 자체가 그 어색함을 인정하는 문장이었다.
//
// 정작 **한국어 운동 사전이 설명까지 달고 앱 안에 있었다.** 번역에만 쓰고 결과로는
// 안 보여줬다. 좋은 자료를 버리고 더 나쁜 것을 기다린 셈이다. 그래서 순서를 뒤집었다 —
// 앱 안의 사전을 치는 동안 바로 보여주고, 외부 DB 는 눌러야 나간다.
//
// **9/1 에 찾는 부분을 부품으로 떼어냈다** (`components/ExerciseFinder.jsx`).
// 기록 화면에서도 같은 것을 쓰기 때문이다 — 기록하다 이름이 생각 안 난다고 화면을
// 나갔다 들어오게 하면 적으려던 것이 끊긴다. **복붙하지 않았다**: 같은 것을 두 곳에
// 두면 반드시 한쪽만 고쳐진다. 이 화면에 남은 것은 제목과 「고르면 어디로 가는가」뿐이다.
//
// ── 찾던 말을 들고 올 수 있다 ── (2026-09-17)
//
// `?q=벤치프레스` 로 열면 그 말을 **친 채로** 열린다. 여태 이 화면은 물음표 뒤를
// 아예 안 봤다 — 다른 화면에서 찾던 말을 들려 보내도 **빈 칸이 열렸다.** 그래서
// 홈 검색은 운동 이름을 치면 「일치하는 항목이 없어요」로 끝났고(갈 곳이 있는데도),
// 홈페이지는 이 화면을 아예 안 거치게 돌려놨다.
//
// 길이를 자른다. 주소창은 아무나 무엇이든 적을 수 있는 자리라, 사전에 있을 리 없는
// 긴 말이 그대로 입력 칸에 들어가면 화면만 어지럽다.
const MAX_Q = 40;

export default function SearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = (params.get('q') || '').slice(0, MAX_Q).trim();
  // **로그인 안 한 사람에게는 안 그린다** — 홈페이지에서도 들어오는 주소다(시안 C)
  const loggedIn = useAuthStore((st) => st.isLoggedIn);
  const workouts = useWorkoutStore((st) => st.workouts);
  const fetchWorkouts = useWorkoutStore((st) => st.fetchAll);
  const today = useToday();
  useEffect(() => { if (loggedIn) fetchWorkouts(); }, [loggedIn, fetchWorkouts]);
  // 이름 무리 · 날 · 최고는 **기록이 바뀔 때만** 센다 — 칠 때마다 세지 않는다 (`data/searchMine.js` 머리글)
  const mine = useMemo(() => (loggedIn ? mineIndex(workouts, today) : []), [loggedIn, workouts, today]);

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        운동 검색
      </div>

      {/* 여기서 고르면 기록 화면으로 데려간다 (그 화면이 이름을 받아 채운다).
          `key` 로 말이 바뀌면 다시 연다 — `initialQuery` 는 처음 한 번만 읽히기 때문에,
          검색 화면에 있는 채로 다른 말을 들고 오면 앞의 말이 그대로 남는다.
          들고 온 말이 없을 때만 자판을 올린다 (있으면 결과부터 보여주는 것이 맞다) */}
      <ExerciseFinder
        key={q}
        initialQuery={q}
        autoFocus={!q}
        pickLabel="기록하기"
        onPick={(name) => navigate('/train', { state: { exercise: name } })}
        above={loggedIn ? (query) => (
          <MineRows
            rows={mineQuery(mine, query)}
            today={today}
            onRecord={(name) => navigate('/train', { state: { exercise: name } })}
            onDay={(date) => navigate('/history', { state: { date } })}
          />
        ) : null}
      />
    </div>
  );
}
