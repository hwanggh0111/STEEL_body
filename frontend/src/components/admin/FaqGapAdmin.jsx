import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';
import { toast } from '../Toast';
import { confirmDialog } from '../ConfirmModal';
import { matchFaq } from '../../pages/support/faq';

// 답이 안 나온 말.
//
// 고객센터의 「무엇이 궁금하세요?」에서 쳤는데 자주 묻는 것이 하나도 안 걸린 말이다.
// FAQ 를 무엇으로 늘릴지 감으로 정하지 않으려고 모은다.
//
// **누가 쳤는지는 서버도 안 남긴다.** 무엇을 모르는지는 알아야 하지만,
// 누가 모르는지까지 알 이유가 없다.

const RANGES = [
  { days: 30, label: '30일' },
  { days: 7, label: '7일' },
  { days: 0, label: '전체' },
];

export default function FaqGapAdmin() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    client.get('/faq-gaps', { params: days ? { days } : {} })
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setError('목록을 불러오지 못했어요'))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(load, [load]);

  const remove = async (row) => {
    const ok = await confirmDialog(
      `「${row.term}」 ${row.count}번을 목록에서 지웁니다.\n\nFAQ 에 답을 넣었거나 볼 것이 아닐 때만 지웁니다. 다시 물어보면 새로 쌓입니다.`,
      { title: '이 말을 지울까요', confirmText: '지우기' },
    );
    if (!ok) return;
    try {
      await client.delete(`/faq-gaps/${row.id}`);
      setRows(prev => prev.filter(r => r.id !== row.id));
      toast('지웠어요');
    } catch {
      toast('지우지 못했어요', 'error');
    }
  };

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        답이 안 나온 말
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 14px' }}>
        고객센터의 「무엇이 궁금하세요?」에서 쳤는데 자주 묻는 것이 하나도 안 걸린 말입니다.
        여기 자주 오르는 말이 곧 FAQ 에 들어가야 할 것입니다.
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          친 말과 횟수, 날짜만 남깁니다. 누가 쳤는지는 남기지 않습니다.
        </span>
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {RANGES.map(r => (
          <button
            key={r.days}
            className={`btn-secondary${days === r.days ? ' active' : ''}`}
            onClick={() => setDays(r.days)}
          >{r.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중…</div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>
          <button className="btn-secondary" onClick={load}>다시 시도</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-state-title">없음</div>
          <div className="empty-state-desc">
            이 기간에 답을 못 찾고 나간 말이 없습니다.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(row => {
            // 지금 FAQ 로 다시 찾아본다. 쌓일 때는 아무것도 안 걸린 말이니,
            // 지금 걸린다면 **그 사이에 답을 넣었다는 뜻**이다 — 지워도 되는 줄이다
            const near = matchFaq(row.term, 1)[0];
            return (
              <div key={row.id} className="card list-item" style={{
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 1,
                  color: row.count >= 5 ? 'var(--accent)' : 'var(--text-secondary)',
                  lineHeight: 1, minWidth: 30, textAlign: 'right', flexShrink: 0,
                }}>{row.count}</div>

                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{row.term}</div>
                  {near ? (
                    <div style={{ fontSize: 11.5, color: 'var(--success)', lineHeight: 1.6 }}>
                      지금은 「{near.topic}」 문답이 걸립니다 · 지워도 됩니다
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      마지막 {String(row.last_at).slice(5, 10)}
                    </div>
                  )}
                </div>

                <button className="btn-secondary" style={{ flexShrink: 0 }} onClick={() => remove(row)}>
                  지우기
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
