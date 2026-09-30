import { useMemo, useState } from 'react';
import SegRow from '../components/SegRow';
import PumpBody, { MARK_WARNING } from '../components/PumpBody';
import { useWorkoutStore } from '../store/workoutStore';
import { useToday } from '../data/useToday';
import { readLS, saveLS } from '../data/safeStorage';
import { SORE_KEY } from '../data/localKeys';
import { MAP_PARTS, buildHeat } from '../data/bodyHeat';
import { searchExercises } from '../data/exerciseDict';
import {
  cleanSore, addSore, removeSore, isSore, soreList, soreLine, askLine,
  restAdvice, adviceLine,
} from '../data/sorePart';
import { previewPart, previewLine, soreWarn } from '../data/partPreview';

// 부위 — **아픈 곳**과 **이 운동이 어디를 달굴지** (2026-09-30).
//
// 시안은 artifact 729be142. 둘 다 부위 이야기라 한 화면에 갈래 둘로 뒀다.
//
// ── 왜 서랍의 제 화면인가 ──
//
// 처음 시안은 이것을 오늘 카드 · 루틴 · 운동 고르기에 **나눠 끼우는** 안이었다.
// 그러면 화면 셋이 같이 바뀌고, 아픔이 어디서 켜졌는지 사람이 못 찾는다.
// **한 자리에 모아 서랍에 둔다** — 탭바는 늘리지 않는다(9/19 에 「기구」 탭을 걷은 선).
//
// ── 여기가 안 하는 것 ──
//
// 진단하지 않는다. 낫는 기간 · 병명 · 원인 · 통증 점수를 말하지 않고, **기록을 막지도
// 않는다** — 아픈데도 하겠다면 그건 그 사람의 일이다. 막으면 사람은 아픔을 안 적고,
// 그러면 이 화면이 아무것도 모르게 된다. 규칙은 `data/sorePart.js` 에 적어뒀다.
//
// 계산은 전부 `data/` 가 한다 — 아픔은 `sorePart.js`, 미리보기는 `partPreview.js`.
// 여기는 **누른 것을 넘기고 그리는 일**만 한다 (`npm run sore` 가 값으로 본다).

const TABS = [
  { key: 'sore', label: '아픔' },
  { key: 'preview', label: '미리보기' },
];

function loadSore() {
  try { return cleanSore(JSON.parse(readLS(SORE_KEY) || 'null')); } catch { return []; }
}

export default function PartsPage() {
  const today = useToday();
  const workouts = useWorkoutStore((s) => s.workouts);
  const [tab, setTab] = useState('sore');
  const [sore, setSore] = useState(loadSore);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);

  const heat = useMemo(() => buildHeat(workouts, today), [workouts, today]);
  const rows = useMemo(() => soreList(sore, today), [sore, today]);
  const advice = useMemo(() => restAdvice(sore, heat), [sore, heat]);

  const put = (next) => { setSore(next); saveLS(SORE_KEY, JSON.stringify(next)); };
  const toggle = (part) => put(isSore(sore, part) ? removeSore(sore, part) : addSore(sore, part, today));

  const found = useMemo(() => (query.trim().length ? searchExercises(query.trim(), 8) : []), [query]);
  const view = useMemo(() => previewPart(picked, heat, sore), [picked, heat, sore]);
  const warn = view ? soreWarn(view) : null;

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        부위
      </div>

      <SegRow items={TABS} value={tab} onChange={setTab} ariaLabel="부위 갈래" />

      {tab === 'sore' ? (
        <>
          {/* ── 무엇을 하는 자리인지 · 무엇을 안 하는지 ──
              「아픔」이라고만 적어두면 사람은 진료를 기대한다. 먼저 선을 긋는다 */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
              아픈 곳을 적어두면 <b>그 부위를 권하지 않아요.</b>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 6 }}>
              <b>진단이 아니에요.</b> 낫는 기간도 병명도 말하지 않고, 아픔에 점수를 매기지
              않아요 — 세는 것은 <b>며칠째</b>인지뿐입니다. <b>기록을 막지도 않아요</b>:
              하실 거면 하셔도 됩니다.
            </div>
          </div>

          {/* 부위 여섯 — 누르면 적히고, 다시 누르면 지워진다 */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              아픈 곳을 눌러주세요
            </div>
            {/* ── 몸 그림 ── (2026-09-30)
                **아픈 곳을 색으로 본다.** 이름만 있으면 「어깨·등」이 어디인지 머리로
                그려야 한다. 그림은 홈트·몸 지도가 쓰는 것을 그대로 쓰되(`PumpBody`),
                아픔은 달아오름과 다른 일이라 **금색이 아니라 경고색**으로 칠한다.
                몸 전체를 `untouched` 로 넘겨 **점선으로 두른다** — 그 그림의 바탕색은
                카드와 거의 같아서(#1c1813 / #1e1a14) 점선이 없으면 몸이 안 보인다 */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
              <PumpBody
                width={58}
                pump={{ byPart: {}, max: 0, touched: [], untouched: MAP_PARTS }}
                /* 값을 직접 적는다 — SVG 속성에 `var(--warning)` 을 넣으면 아무 색도 안 칠해진다 */
                mark={{ parts: rows.map((r) => r.part), color: MARK_WARNING }}
                label={rows.length
                  ? `${rows.map((r) => r.part).join(' · ')}가 아프다고 적혀 있어요`
                  : '아직 아픈 곳을 안 적었어요'}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, minWidth: 0 }}>
                {rows.length
                  ? <>칠한 곳이 <b style={{ color: 'var(--warning)' }}>아프다고 적어둔 곳</b>이에요.</>
                  : <>여기를 누르면 몸 그림에 표시돼요. <b>등은 앞에서 안 보여서</b> 가슴 자리에 옅게 겹쳐 그려요.</>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {MAP_PARTS.map((part) => {
                const on = isSore(sore, part);
                return (
                  <button
                    key={part}
                    onClick={() => toggle(part)}
                    aria-pressed={on}
                    className="btn-secondary"
                    style={{
                      minHeight: 42, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
                      ...(on ? {
                        borderColor: 'var(--warning)', color: 'var(--warning)',
                        background: 'var(--warning-dim)',
                      } : null),
                    }}
                  >{part}</button>
                );
              })}
            </div>
          </div>

          {rows.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 11 }}>
                적어둔 것 — 오래된 것부터
              </div>
              {rows.map((row) => (
                <div
                  key={row.part}
                  style={{
                    paddingBottom: 10, marginBottom: 10,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{soreLine(row)}</span>
                    <button
                      onClick={() => toggle(row.part)}
                      className="btn-secondary"
                      style={{ width: 'auto', padding: '5px 10px', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer' }}
                    >지우기</button>
                  </div>
                  {/* **묻기만 한다.** 나았는지는 우리가 알 수 없어서 저절로 지우지 않는다 */}
                  {askLine(row) && (
                    <div style={{ fontSize: 11.5, color: 'var(--warning)', lineHeight: 1.65, marginTop: 5 }}>
                      {askLine(row)}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                나으면 지워주세요 — <b>저절로 사라지지 않아요.</b> 나았는지는 본인만 알아요.
              </div>
            </div>
          )}

          {/* ── 그래서 오늘 무엇을 ──
              **뺀 것을 같이 말한다.** 조용히 빼면 왜 어깨가 안 보이는지 모른다 */}
          <div
            className="card"
            style={{
              borderColor: rows.length ? 'var(--accent)' : 'var(--border)',
              background: rows.length ? 'var(--accent-dim)' : undefined,
            }}
          >
            <div style={{ fontSize: 11.5, letterSpacing: 1, color: 'var(--accent)', marginBottom: 7 }}>
              오늘 할 것
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {adviceLine(advice)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.65 }}>
              식은 차례는 <b>몸 지도</b>가 매긴 것을 그대로 써요 — 여기서 다시 매기면 두
              화면이 다른 말을 하게 돼요.
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
              운동 이름을 찾으면 <b>어디가 달아오를지</b> 먼저 보여드려요.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 6 }}>
              몸 지도는 <b>한 뒤에</b> 달아올라요. 고르는 건 하기 전이라 여기서 미리 봅니다.
              부위는 <b>운동 사전에 적어둔 것</b>이고, 식은 날수는 몸 지도가 센 것이에요 —
              <b> 새로 지어내는 값이 없어요.</b>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <label className="label" htmlFor="pv-q">운동 찾기</label>
            <input
              id="pv-q"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="랫풀다운 · ㄹㅍ · 등"
            />
            {found.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
                {found.map((e) => (
                  <button
                    key={e.ko}
                    onClick={() => { setPicked(e.ko); setQuery(''); }}
                    className="btn-secondary"
                    style={{
                      textAlign: 'left', padding: '9px 10px', fontSize: 13,
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >{e.ko}</button>
                ))}
              </div>
            )}
          </div>

          {view ? (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                {/* 몸 그림은 **홈트가 쓰는 것을 그대로** 쓴다 — 두 화면이 같은 모양으로
                    같은 말을 해야 한다 (새로 그리면 어느 날 둘이 어긋난다) */}
                <PumpBody
                  width={62}
                  /* **나머지 몸을 점선으로 두른다.** 한 곳만 칠하면 그림의 바탕색이
                     카드와 거의 같아서(#1c1813 / #1e1a14) 금색 덩이만 떠 보인다 */
                  pump={view.known
                    ? {
                      byPart: { [view.part]: { score: 1 } }, max: 1, touched: [view.part],
                      untouched: MAP_PARTS.filter((p) => p !== view.part),
                    }
                    : { byPart: {}, max: 0, touched: [], untouched: MAP_PARTS }}
                  now={view.known ? { main: [view.part] } : null}
                  label={view.known
                    ? `${view.name}은 ${view.part}를 달궈요`
                    : `${view.name}은 어디를 달굴지 몰라요`}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{view.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 5 }}>
                    {previewLine(view)}
                  </div>
                  {/* 아픈 부위여도 **막지 않는다.** 적어둔 것을 알려줄 뿐이다 */}
                  {warn && (
                    <div style={{ fontSize: 12, color: 'var(--warning)', lineHeight: 1.65, marginTop: 7 }}>
                      {warn}
                    </div>
                  )}
                </div>
              </div>
              {/* 사전이 모르는 이름이면 **부위를 짐작하지 않는다** */}
              {!view.known && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 11 }}>
                  아무 부위나 골라 적으면 몸 지도가 그 뒤로 틀린 색을 내요. 그래서
                  <b> 모른다고 적어둡니다.</b>
                </div>
              )}
            </div>
          ) : (
            /* 아직 안 골랐을 때도 **빈 칸으로 두지 않는다** — 지금 식은 곳을 보여준다 */
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                지금 식어 있는 곳 — 몸 지도가 센 것
              </div>
              {/* **고르기 전에도 몸을 보여준다.** 빈 칸에 글자만 있으면 이 화면이 몸
                  이야기를 하는 자리인지 안 보인다. 아무 곳도 칠하지 않는다 —
                  식은 것은 「안 한 것」이라 칠할 것이 없다(그 규칙이 이 그림의 첫 줄이다) */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
                <PumpBody
                  width={58}
                  pump={{ byPart: {}, max: 0, touched: [], untouched: MAP_PARTS }}
                  label="운동을 고르면 그 운동이 달굴 곳을 여기에 칠해드려요"
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, minWidth: 0 }}>
                  운동을 고르면 <b style={{ color: 'var(--accent)' }}>달아오를 곳</b>을 여기에 칠해드려요.
                </div>
              </div>
              {heat.list.slice(0, 3).map((s) => (
                <div
                  key={s.part}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    gap: 8, paddingBottom: 8, marginBottom: 8,
                    borderBottom: '1px solid var(--border)', fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{s.part}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {s.days === null ? '8주 안에 한 번도' : s.days === 0 ? '오늘 했어요' : `${s.days}일째`}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                위에서 운동을 찾으면 그 운동이 어디를 달굴지 알려드려요.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
