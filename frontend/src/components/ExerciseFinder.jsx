import { useState, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  searchExercises, siblingsOf, koreanNameOf, translateQuery,
} from '../data/exerciseDict';

// 운동 찾기 — **화면이 아니라 부품이다.**
//
// 이 덩어리는 원래 「운동 검색」 화면 안에만 있었다. 그래서 기록하다 운동 이름이
// 생각 안 나면 **화면을 나갔다 들어와야** 했다 — 적으려던 것을 도중에 끊는 셈이다.
//
// 9/1 에 기록 화면에도 넣으면서 **복붙하지 않고 떼어냈다.** 같은 것을 두 곳에 두면
// 반드시 한쪽만 고쳐진다 (이 앱에서 이미 여러 번 겪었다 — 점검 아이콘 · 보안 규칙 ·
// 응답 모양). 지금은 「운동 검색」 화면과 기록 화면이 **이 파일 하나**를 같이 쓴다.
//
// 하는 일은 그대로다:
//   · 앱 안의 사전을 **치는 동안 바로** 보여준다 (한국어 · 영어 · 초성 · 부위)
//   · 고른 운동의 **같은 갈래**를 펼쳐본다 (벤치프레스 → 인클라인 · 디클라인 …)
//   · 앱에서 못 찾으면 **눌렀을 때만** 인터넷(wger.de)에 나간다. 끊겨도 검색은 된다
//
// 고른 뒤에 무엇을 할지는 **쓰는 쪽이 정한다**(`onPick`) — 검색 화면은 기록 화면으로
// 데려가고, 기록 화면은 그 자리에서 이름 칸을 채운다.

const CATEGORIES = [
  { label: '가슴', q: '가슴' },
  { label: '등', q: '등' },
  { label: '어깨', q: '어깨' },
  { label: '하체', q: '하체' },
  { label: '팔', q: '팔' },
  { label: '코어', q: '코어' },
];

const EXTERNAL_TIMEOUT = 8000;

// 카드에 할 일이 둘이다 — 고르기와 같은 갈래 펼쳐보기.
// 카드를 통째로 「고르기」로 두면 갈래를 볼 방법이 없어진다.
// 그래서 **고르는 것은 단추**, 나머지 자리는 갈래 펼치기다.
function Card({ ko, en, desc, tag, pickLabel, onPick, onExpand, expanded }) {
  return (
    <div className="card list-item" style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{ flexGrow: 1, minWidth: 0, cursor: onExpand ? 'pointer' : 'default' }}
          onClick={onExpand || undefined}
          role={onExpand ? 'button' : undefined}
          tabIndex={onExpand ? 0 : undefined}
          onKeyDown={(e) => { if (onExpand && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onExpand(); } }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: 'var(--text-primary)' }}>
              {ko}
            </span>
            {tag && <span className="badge badge-accent">{tag}</span>}
          </div>
          {en && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{en}</div>}
          {desc && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.65 }}>
              {desc}
            </div>
          )}
        </div>
        <button
          className="btn-secondary"
          style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '6px 12px' }}
          onClick={onPick}
        >{pickLabel}</button>
      </div>
      {onExpand && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {expanded ? '갈래 접기' : '눌러서 같은 갈래 보기'}
        </div>
      )}
    </div>
  );
}

/**
 * @param onPick      운동을 고르면 부르는 함수. 이름(문자열)을 준다
 * @param pickLabel   고르는 단추에 적을 말 ('기록하기' · '이 운동으로')
 * @param autoFocus   열자마자 입력칸에 커서를 둘지 (기록 화면에서 펼칠 때 쓴다)
 * @param compact     기록 화면 안에 들어갈 때. 머리 설명을 줄인다
 */
export default function ExerciseFinder({ onPick, pickLabel = '기록하기', autoFocus = false, compact = false }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [external, setExternal] = useState(null);   // null=안 찾음, []=없음
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 늦게 온 응답이 새 검색을 덮어쓰지 않게 요청에 번호를 매긴다
  const seqRef = useRef(0);

  const typed = query.trim().length >= 2;
  // 앱 안의 사전은 네트워크가 필요 없다. 치는 동안 바로 나온다
  const results = useMemo(() => (typed ? searchExercises(query) : []), [query, typed]);
  const siblings = useMemo(() => (picked ? siblingsOf(picked) : []), [picked]);

  const setQ = (v) => {
    setQuery(v);
    setPicked(null);
    setExternal(null);
    setError('');
  };

  // 외부 DB — **눌러야 나간다.** 앱 안에서 못 찾았을 때만 쓸모가 있다
  const searchExternal = async () => {
    const term = translateQuery(query);
    const seq = ++seqRef.current;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(
        `https://wger.de/api/v2/exercise/search/?term=${encodeURIComponent(term)}&language=english&format=json`,
        { timeout: EXTERNAL_TIMEOUT },
      );
      if (seq !== seqRef.current) return;
      setExternal(data.suggestions || []);
    } catch {
      if (seq !== seqRef.current) return;
      // 실패했는데 옛 결과가 남아 있으면 오류 문구 아래 지난 검색이 붙어
      // 검색이 된 것처럼 읽힌다
      setExternal([]);
      setError('인터넷에서 찾지 못했어요. 잠시 후 다시 해보세요.');
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  };

  return (
    <div>
      {!compact && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.7 }}>
          한국어 · 영어 · 초성으로 찾습니다. 부위 이름으로도 됩니다.
          <br />인터넷이 끊겨도 찾을 수 있습니다.
        </p>
      )}

      <input
        className="input"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder="벤치프레스 · ㅂㅊㅍㄹㅅ · 가슴 · squat"
        style={{ marginBottom: 10 }}
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: compact ? 12 : 18 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.q}
            className={`btn-secondary${query.trim() === c.q ? ' active' : ''}`}
            onClick={() => setQ(c.q)}
          >{c.label}</button>
        ))}
      </div>

      {!typed ? (
        <div className="empty-state" style={{ padding: compact ? '20px 0' : '40px 0' }}>
          <div className="empty-state-title">무엇을 찾으세요</div>
          <div className="empty-state-desc">두 글자부터 찾기 시작합니다. 위의 부위를 눌러도 됩니다.</div>
        </div>
      ) : (
        <>
          {results.length > 0 && (
            <>
              <div className="label">앱에 있는 운동 {results.length}개</div>
              {results.map((e) => (
                <Card
                  key={e.ko}
                  ko={e.ko}
                  en={e.en}
                  desc={e.desc}
                  pickLabel={pickLabel}
                  onPick={() => onPick(e.ko)}
                  onExpand={siblingsOf(e).length > 0
                    ? () => setPicked(picked?.ko === e.ko ? null : e)
                    : null}
                  expanded={picked?.ko === e.ko}
                />
              ))}
            </>
          )}

          {results.length === 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                앱 안에서는 못 찾았어요
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                이름 그대로 적으셔도 됩니다. 아래에서 인터넷으로 더 찾아볼 수도 있어요.
              </div>
              <button
                className="btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => onPick(query.trim())}
              >「{query.trim()}」 그대로 쓰기</button>
            </div>
          )}

          {/* 같은 갈래 — 하나 고른 뒤에 옆 갈래를 보여준다 */}
          {siblings.length > 0 && (
            <>
              <div className="label" style={{ marginTop: 18 }}>{picked.group} 갈래 {siblings.length}개</div>
              {siblings.map((e) => (
                <Card key={e.ko} ko={e.ko} en={e.en} desc={e.desc} pickLabel={pickLabel} onPick={() => onPick(e.ko)} />
              ))}
            </>
          )}

          {/* 외부 DB — 눌러야 나간다 */}
          <div style={{ marginTop: 20 }}>
            {external === null ? (
              <button className="btn-secondary" style={{ width: '100%' }} disabled={loading} onClick={searchExternal}>
                {loading ? '인터넷에서 찾는 중…' : '인터넷에서 더 찾기'}
              </button>
            ) : (
              <>
                <div className="label">인터넷에서 찾은 것 {external.length}개</div>
                {external.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    인터넷에서도 없었어요. 이 목록은 영어 자료라 한국어 이름으로는 잘 안 나옵니다.
                  </div>
                ) : (
                  external.map((s, i) => {
                    const ko = koreanNameOf(s.value || s.data?.name);
                    const name = s.value || s.data?.name || '';
                    return (
                      <Card
                        key={`${name}-${i}`}
                        ko={ko || name}
                        en={ko ? name : null}
                        desc={s.data?.category ? `분류 · ${s.data.category}` : null}
                        tag="인터넷"
                        pickLabel={pickLabel}
                        onPick={() => onPick(ko || name)}
                      />
                    );
                  })
                )}
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.7 }}>
                  wger.de 의 공개 자료입니다. 영어 전용이라 설명이 없을 수 있습니다.
                </div>
              </>
            )}
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>
              {error}
              <button
                onClick={searchExternal}
                style={{
                  marginLeft: 8, background: 'none', border: '1px solid var(--danger)',
                  color: 'var(--danger)', padding: '2px 10px', borderRadius: 'var(--radius)',
                  cursor: 'pointer', fontSize: 12,
                }}
              >재시도</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
