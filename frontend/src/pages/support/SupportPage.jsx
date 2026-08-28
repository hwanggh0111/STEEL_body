import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntroStats, FEATURES } from './introData';
import ReportBox from './ReportBox';
import client from '../../api/client';
import { useReportStore } from '../../store/reportStore';
import { readLS, saveLS } from '../../data/safeStorage';
import { getSchedules, fetchSchedules } from '../../components/MaintenanceScreen';
import pkg from '../../../package.json';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 최근 바뀐 것 — 손으로 적지 않는다.
// scripts/gen-changelog.mjs 가 git 커밋에서 뽑아 changelog.json 을 만들고, dev·build 앞에서 자동으로 돈다.
// 커밋으로 설명이 안 되는 것은 data/notices.json 에 손으로 적는다. 둘은 feedData.js 에서 한 목록으로 합쳐진다.
import { FEED } from './feedData';
import FeedList from './FeedList';
import Satisfaction from './Satisfaction';
import { FAQ, matchFaq } from './faq';
import { SEEN_REPLY_KEY as SEEN_REPLY_LS_KEY } from '../../data/localKeys';

const CHANGES_SHOWN = 6;

// 어디까지 읽었는지. 답변이 달린 시각(ISO)을 그대로 넣어두고 그보다 새 것이 있으면 알린다
const SEEN_REPLY_KEY = SEEN_REPLY_LS_KEY;

function Sec({ children }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 3, color: 'var(--text-muted)', marginBottom: 20 }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 고객센터
//
// **이름이 「고객센터」다.** 그런데 들어오면 감성 문구 두 덩어리와 「지금까지 몇 회
// 적었다」와 「무엇을 할 수 있나」 여섯 줄을 지나야 제보함이 나왔고, 그마저 접혀 있었다.
// **볼일을 보러 온 사람 앞에 소개를 세워둔 것**이다.
//
// 여기 오는 이유는 셋뿐이다 — ① 안 되는 것을 말하러 ② 답을 찾으러 ③ 뭐가 바뀌었나 보러.
// 그 순서로 다시 세웠다.
//
//   내 제보(답이 왔나) → 점검 예정 → 무엇을 도와드릴까요(갈래 셋) → 제보함
//   → 자주 묻는 것 → 최근 바뀐 것 → 만족도 → 이 앱은(접힘) → 앱 정보
//
// **갈래를 먼저 고르게 한다.** 예전에는 「제보함 열기」 하나를 누른 뒤에야 안에서
// 버그·문의·건의를 골랐다. 밖에서 고르면 한 번에 자기 자리로 들어간다.
//
// **소개를 지우지는 않았다.** 히어로 문장과 「내 이야기」 숫자, 기능 목록은
// 맨 아래 「이 앱은」으로 접어 뒀다. 처음 온 사람은 펼쳐 읽고, 매일 오는 사람은 안 본다.
//
// 표도 카드도 거의 쓰지 않는다. 큰 글씨와 문장으로 읽히게 한다 —
// 내 숫자를 칸에 넣지 않고 문장 안에 박아 넣는 게 이 페이지의 성격이다.
// ─────────────────────────────────────────────────────────────

const Num = ({ children }) => (
  <span style={{
    fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35em',
    letterSpacing: 1, color: 'var(--accent)',
  }}>{children}</span>
);

// 무엇을 도와드릴까요 — 제보함의 세 유형을 밖으로 꺼낸 것이다.
// 말은 「버그 · 문의 · 건의」가 아니라 **사람이 하는 말**로 적는다.
// 자기가 겪은 일이 「버그」인지 「문의」인지를 먼저 판단하게 하면 거기서 막힌다
const HELP = [
  { kind: 'bug',  icon: '🐞', line: '안 되는 게 있어요', sub: '이상하게 나오거나 눌러도 안 될 때' },
  { kind: 'ask',  icon: '💬', line: '어떻게 쓰는지 모르겠어요', sub: '찾는 게 어디 있는지 물어보실 때' },
  { kind: 'idea', icon: '💡', line: '이랬으면 좋겠어요', sub: '있었으면 하는 것이 있을 때' },
];

export default function SupportPage() {
  const navigate = useNavigate();
  const s = useIntroStats();
  const [openFaq, setOpenFaq] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [faqQ, setFaqQ] = useState('');
  // 제보함은 접어둔다. 펼쳐두면 폼과 목록이 페이지의 절반을 먹어서,
  // 그 아래 자주 묻는 것과 바뀐 것이 한참 밀려난다
  const [reportOpen, setReportOpen] = useState(false);
  const [reportKind, setReportKind] = useState('');
  const reportRef = useRef(null);

  // 접어두는 대신, 답변이 온 것을 놓치지 않게 목록을 여기서도 본다.
  // store 가 진행 중인 요청을 하나로 묶으므로 제보함과 같이 열려도 요청은 한 번이다
  const reports = useReportStore(r => r.items);
  const fetchReports = useReportStore(r => r.fetchAll);
  useEffect(() => { fetchReports(); }, [fetchReports]);

  const latestReply = useMemo(
    () => reports.reduce((max, i) => (i.reply_at && i.reply_at > max ? i.reply_at : max), ''),
    [reports],
  );
  const [seenReply, setSeenReply] = useState(() => readLS(SEEN_REPLY_KEY) || '');
  const hasNewReply = !!latestReply && latestReply > seenReply;

  // 답을 달아놓고 접힌 채로 두면 답한 게 아니다. 새 답변이 있으면 저절로 펼친다
  useEffect(() => { if (hasNewReply) setReportOpen(true); }, [hasNewReply]);

  // 펼쳐서 볼 수 있게 된 시점에 읽은 것으로 표시한다
  useEffect(() => {
    if (!reportOpen || !latestReply || latestReply === seenReply) return;
    saveLS(SEEN_REPLY_KEY, latestReply);
    setSeenReply(latestReply);
  }, [reportOpen, latestReply, seenReply]);

  // 어디서 눌러도 같은 길로 연다.
  // 이미 열려 있으면 닫지 않고 그 자리로 데려다만 준다 — 쓰던 글이 사라지면 안 된다
  const openReport = (kind = '') => {
    if (kind) setReportKind(kind);
    setReportOpen(true);
    // 펼쳐진 뒤에 스크롤해야 자리가 맞는다
    requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // 점검은 진짜 스케줄을 읽는다. 잡힌 게 없으면 이 구역 자체가 안 나온다 —
  // "예정된 점검 없음" 을 굳이 알릴 이유가 없다.
  //
  // 캐시로 먼저 그리고 서버에서 받아 갱신한다. 캐시만 읽으면 이 기기에서 한 번도
  // 받아본 적 없을 때 영영 비어 있다
  const [schedules, setSchedules] = useState(() => { try { return getSchedules() || []; } catch { return []; } });
  useEffect(() => { fetchSchedules().then(list => setSchedules(list || [])); }, []);

  const answered = reports.filter(r => r.reply).length;

  // 자주 묻는 것 찾기.
  //
  // 답이 하나도 안 나온 말은 **2초 멈춘 뒤** 서버에 남긴다 — 치는 동안 스쳐 지나가는
  // 글자까지 보내면 목록이 쓰레기가 된다. 그 정도 멈췄다는 것은 「여기엔 없네요」를
  // 읽었다는 뜻이다. 같은 말은 이 화면이 살아 있는 동안 한 번만 보낸다.
  // 남기는 것은 친 말뿐이고, 누가 쳤는지는 서버도 안 남긴다 (제보함 쪽과 같은 규칙).
  const faqTyped = faqQ.trim().length >= 2;
  const faqHits = useMemo(() => (faqTyped ? matchFaq(faqQ, FAQ.length) : []), [faqQ, faqTyped]);
  const shownFaq = faqTyped ? faqHits : FAQ;

  const gapSentRef = useRef(new Set());
  useEffect(() => {
    if (!faqTyped || faqHits.length > 0) return;
    const term = faqQ.trim();
    if (gapSentRef.current.has(term)) return;
    const timer = setTimeout(() => {
      gapSentRef.current.add(term);
      // 실패해도 아무 일도 하지 않는다 — 이것 때문에 화면이 시끄러워질 자리가 아니다
      client.post('/faq-gaps', { term }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [faqQ, faqTyped, faqHits.length]);

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* 이 페이지가 하는 일을 한 문장으로. 감성 문구는 아래 「이 앱은」으로 내렸다 */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 3,
          color: 'var(--accent)', margin: '0 0 8px',
        }}>고객센터</h2>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: 'var(--text-primary)', margin: 0, fontWeight: 300 }}>
          안 되는 게 있으면 알려주세요.<br />확인하고 여기에 답을 답니다.
        </p>
      </div>

      {/* 내 제보 — 답이 왔는지가 제일 먼저다.
          예전에는 이 사실이 페이지 맨 아래 접힌 단추 안에만 있었다 */}
      {reports.length > 0 && (
        <div
          onClick={() => openReport()}
          style={{
            borderLeft: `2px solid ${hasNewReply ? 'var(--accent)' : 'var(--border-hover)'}`,
            paddingLeft: 18, marginBottom: 28, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <div style={{ flexGrow: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 6 }}>내 제보</div>
            <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 300, lineHeight: 1.8 }}>
              {hasNewReply
                ? <>새 답변이 왔습니다.</>
                : answered > 0
                  ? <>보낸 <Num>{reports.length}</Num>건 중 <Num>{answered}</Num>건에 답이 달렸습니다.</>
                  : <><Num>{reports.length}</Num>건을 보내셨습니다. 확인하는 대로 답을 답니다.</>}
            </div>
          </div>
          {hasNewReply && (
            <span style={{
              flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--on-accent)',
              background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '3px 9px',
            }}>새 답변</span>
          )}
        </div>
      )}

      {/* 점검 예정 — 지금 당장 영향을 주는 것이라 위로 올렸다.
          잡혀 있을 때만 나온다 */}
      {schedules.length > 0 && (
        <div style={{
          borderLeft: '2px solid var(--warning)', paddingLeft: 18, marginBottom: 28,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: 'var(--warning)', marginBottom: 8 }}>점검 예정</div>
          {schedules.slice(0, 3).map((sc, i) => {
            const end = sc.startHour * 60 + sc.startMin + sc.durationMin;
            const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            return (
              <div key={i} style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.85, fontWeight: 300 }}>
                {sc.days?.length ? `매주 ${sc.days.map(d => DAY_LABELS[d]).join('·')} ` : ''}
                {hhmm(sc.startHour, sc.startMin)} – {hhmm(Math.floor(end / 60) % 24, end % 60)}
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}> · {sc.reason}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 무엇을 도와드릴까요 — 갈래를 밖에서 고른다 */}
      <div style={{ marginBottom: 34 }}>
        <Sec>무엇을 도와드릴까요</Sec>
        {HELP.map(h => (
          <div
            key={h.kind}
            onClick={() => openReport(h.kind)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
              padding: '15px 0', borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">{h.icon}</span>
            <span style={{ flexGrow: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, color: 'var(--text-primary)', fontWeight: 400 }}>{h.line}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{h.sub}</span>
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 15, flexShrink: 0 }}>›</span>
          </div>
        ))}
      </div>

      {/* 제보함 — 갈래를 누르면 여기가 그 유형으로 열린다 */}
      <div ref={reportRef} style={{ scrollMarginTop: 12, marginBottom: reportOpen ? 40 : 34 }}>
        {reportOpen ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              gap: 10, marginBottom: 20,
            }}>
              <span style={{ fontSize: 11, letterSpacing: 3, color: 'var(--text-muted)' }}>제보함</span>
              <button
                onClick={() => setReportOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  font: 'inherit', fontSize: 12.5, color: 'var(--text-muted)',
                }}
              >접기</button>
            </div>
            <ReportBox embedded initialKind={reportKind} />
          </>
        ) : (
          <button
            onClick={() => openReport()}
            style={{
              background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
              borderRadius: 'var(--radius)', padding: '11px 16px', width: '100%',
              display: 'flex', alignItems: 'center', gap: 10,
              color: 'var(--text-secondary)', fontSize: 13.5,
            }}
          >
            <span style={{ color: 'var(--accent)' }} aria-hidden="true">📮</span>
            <span>보낸 제보 보기 · 직접 쓰기</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 15 }}>+</span>
          </button>
        )}
      </div>

      {/* 자주 묻는 것 — 같은 질문이 문의로 반복되면 여기로 올린다 */}
      <div style={{ marginBottom: 40 }}>
        <Sec>자주 묻는 것</Sec>

        {/* 찾기.
            **답이 안 나온 말은 여기서도 쌓인다.** 예전에는 제보함 안의
            「무엇이 궁금하세요?」 한 곳에서만 모았는데, 오늘 갈래를 밖에서 고르게
            바꾸면서 그 자리를 건너뛰는 길이 생겼다. 관리자 화면의 「못 찾은 말」은
            **실제로 물어본 말이 쌓여야** 쓸모가 있다 — 모으는 자리를 줄이면 안 된다 */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            className="input"
            type="text"
            value={faqQ}
            onChange={(e) => setFaqQ(e.target.value)}
            placeholder="궁금한 것을 쳐보세요 (예: 기록, 정지)"
            style={{ fontSize: 13.5, paddingRight: faqQ ? 34 : undefined }}
          />
          {faqQ && (
            <button
              onClick={() => setFaqQ('')}
              aria-label="찾기 지우기"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 13, padding: 6, lineHeight: 1,
              }}
            >✕</button>
          )}
        </div>

        {faqTyped && faqHits.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.8, padding: '4px 0 12px' }}>
            「{faqQ.trim()}」에 대한 답이 아직 없습니다. 무엇을 찾으셨는지는 남겨뒀습니다 —
            같은 것을 여러 분이 찾으시면 여기에 올려둡니다.
            <br />
            <button
              onClick={() => openReport('ask')}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                font: 'inherit', color: 'var(--accent)', borderBottom: '1px solid var(--accent)',
                marginTop: 6,
              }}
            >지금 바로 물어보기</button>
          </div>
        )}

        {shownFaq.map((f, i) => {
          const on = openFaq === i;
          return (
            <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <div
                onClick={() => setOpenFaq(on ? null : i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 0', cursor: 'pointer',
                }}
              >
                <span style={{
                  fontSize: 15, color: on ? 'var(--accent)' : 'var(--text-primary)',
                  fontWeight: 400, flex: 1,
                }}>{f.q}</span>
                <span style={{
                  color: 'var(--text-muted)', fontSize: 15, flexShrink: 0,
                  transform: on ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s',
                }}>+</span>
              </div>
              {on && (
                <div style={{
                  fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.85,
                  padding: '0 0 16px', maxWidth: 440,
                }}>{f.a}</div>
              )}
            </div>
          );
        })}
        {faqTyped && faqHits.length > 0 && shownFaq.length < FAQ.length && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10 }}>
            「{faqQ.trim()}」로 찾은 {faqHits.length}건
          </div>
        )}
        {/* 지금은 두 개뿐이다. 지어내서 채우지 않는다 —
            관리자 화면의 「못 찾은 말」에 실제로 묻는 말이 쌓이면 그걸 보고 채운다 */}
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.7 }}>
          찾는 게 없으면{' '}
          <button
            onClick={() => openReport('ask')}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              font: 'inherit', color: 'var(--accent)', borderBottom: '1px solid var(--accent)',
            }}
          >문의로 물어봐</button>
          주세요. 답이 되면 여기에 올려둡니다.
        </div>
      </div>

      {/* 최근 바뀐 것 */}
      <div style={{ marginBottom: 40 }}>
        <Sec>최근 바뀐 것</Sec>
        <FeedList items={FEED.slice(0, CHANGES_SHOWN)} />

        {/* 여기 여섯 줄만 보여준다. 나머지는 공지함에 있다 */}
        <button
          onClick={() => navigate('/support/notices')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            marginTop: 16, color: 'var(--accent)', fontSize: 13.5,
          }}
        >공지함에서 전부 보기 ({FEED.length}) →</button>
      </div>

      {/* 만족도 — 예전에는 히어로 바로 아래, 페이지에서 두 번째였다.
          안 되는 것을 말하러 온 사람 앞을 막고 별점을 묻고 있었다. 볼일 뒤로 내렸다.
          한 번 매기면 다음부터는 이 자리가 아예 안 나온다 */}
      <div style={{ marginBottom: 40 }}>
        <Satisfaction onOpenReport={() => openReport()} />
      </div>

      {/* 이 앱은 — 소개. 지우지 않고 접었다.
          처음 온 사람은 펼쳐 읽고, 매일 오는 사람은 안 본다 */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 26, marginBottom: 12 }}>
        <button
          onClick={() => setAboutOpen(v => !v)}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            fontSize: 11, letterSpacing: 3, color: 'var(--text-muted)',
          }}
        >
          <span>이 앱은</span>
          <span style={{
            marginLeft: 'auto', fontSize: 15,
            transform: aboutOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s',
          }}>+</span>
        </button>

        {aboutOpen && (
          <div style={{ marginTop: 24 }}>
            <p style={{
              fontSize: 24, lineHeight: 1.45, color: 'var(--text-primary)',
              fontWeight: 300, margin: '0 0 18px', letterSpacing: -0.3,
            }}>
              쉬웠던 날은 없었다.<br />
              그래서 전부 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>값</span>이 있다.
            </p>
            <p style={{
              fontSize: 14.5, lineHeight: 1.85, color: 'var(--text-secondary)',
              margin: '0 0 32px', maxWidth: 380,
            }}>
              빠진 날까지 전부 남는다.<br />
              언젠가 처음부터 읽게 된다.
            </p>

            {/* 내 이야기 — 숫자를 문장에 박되, 한 줄에 한 문장씩.
                한 문단으로 이어 붙이면 기록이 쌓일수록 글자벽이 된다 */}
            <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 18, marginBottom: 32 }}>
              {s.totalWorkouts > 0 ? (
                <div style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 300 }}>
                  <div style={{ lineHeight: 1.9 }}>지금까지 <Num>{s.totalWorkouts.toLocaleString()}</Num>회 적었다.</div>
                  <div style={{ lineHeight: 1.9 }}>
                    {s.weekDays > 0
                      ? <>이번 주만 <Num>{s.weekDays}</Num>일 나왔다.</>
                      : <>이번 주는 오늘이 첫 날이 된다.</>}
                  </div>
                  {s.latest && (
                    <div style={{ lineHeight: 1.9 }}>최근 체중은 <Num>{s.latest.weight}</Num>kg.</div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 16, lineHeight: 1.95, color: 'var(--text-primary)', margin: 0, fontWeight: 300 }}>
                  누구의 첫 줄도 대단하지 않았다.<br />한 세트면 충분하다.
                </p>
              )}
            </div>

            {/* 무엇을 할 수 있나 — 번호 매긴 목록 */}
            <div style={{ marginBottom: 8 }}>
              <Sec>무엇을 할 수 있나</Sec>
              {FEATURES.map((f, i) => (
                <div
                  key={f.path}
                  onClick={() => navigate(f.path)}
                  style={{
                    display: 'flex', gap: 16, alignItems: 'baseline', cursor: 'pointer',
                    padding: '13px 0', borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 13,
                    color: 'var(--text-muted)', width: 20, flexShrink: 0,
                  }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 500 }}>{f.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto', textAlign: 'right' }}>{f.short}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/workout')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
                color: 'var(--accent)', borderBottom: '2px solid var(--accent)',
                paddingBottom: 4, marginTop: 26,
              }}
            >기록하러 가기 →</button>
          </div>
        )}
      </div>

      {/* 앱 정보 — 표로 벌려두면 세 줄짜리가 여섯 줄이 된다. 한 줄로 붙인다.
          「게임 진행은 이 기기에」라고 적혀 있었다 — 게임은 8/25 에 전부 걷어냈다.
          없는 기능을 앱 정보가 말하고 있었다 */}
      <div style={{
        borderTop: '1px solid var(--border)', marginTop: 28, paddingTop: 20,
        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.9,
      }}>
        <div>v{pkg.version} · 다크 전용 · 기록은 서버에 남습니다 (기기를 바꿔도 그대로)</div>
        <div>브라우저 메뉴의 <b style={{ color: 'var(--text-secondary)' }}>홈 화면에 추가</b>를 누르면 앱처럼 열립니다</div>
      </div>
    </div>
  );
}
