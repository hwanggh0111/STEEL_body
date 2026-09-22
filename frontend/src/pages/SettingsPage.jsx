import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestTimerStore, PRESETS } from '../store/restTimerStore';
import { useSettingsStore, BREATH_WHERE, BREATH_MAX, BREATH_SENSE } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { TONES, VOLUMES, previewTone } from '../data/alertSound';
import { micSupported } from '../data/useBreath';
import { speechSupported } from '../data/voiceLog';
import { canLock } from '../data/appLock';
import LockSetup from '../components/LockSetup';
import PasswordChangeModal from '../components/PasswordChangeModal';
import AccountDeleteModal from '../components/AccountDeleteModal';
import { leaveApp } from '../data/leaveApp';
import client from '../api/client';
import BreathCheck from '../components/BreathCheck';
import NavIcon from '../components/NavIcon';
import { toast } from '../components/Toast';

// 설정함 (2026-09-22).
//
// ── 왜 만들었나 ──
//
// 설정이 **일곱 군데에 흩어져 있었다.** 휴식 타이머 소리를 바꾸려면 운동을 시작해
// 타이머를 띄워야 했고, 「숨 보고 쉬기」는 홈트에서 기능성을 고른 뒤에만 있었다.
// 화면 켜두기와 목소리로 적기는 **끌 길이 아예 없었고**, 성별은 인바디에서 한 번 묻고
// 나면 다시 바꿀 수 없었다.
//
// ── 기어 하나에 전부 ──
//
// 설정인 것은 **하나도 밖에 안 남긴다** — 앱 잠금 · 운동 알림 · 기록 챙기기까지
// 여기 들어온다. 「그건 저기 있어요」로 미루면 사람은 **그 기능이 없다고** 생각한다.
//
// **옛 자리도 살려둔다.** 계정 시트의 앱 잠금, 고객센터의 내려받기는 그대로 둔다 —
// 쓰던 사람이 다시 찾게 만들 이유가 없다. **같은 값을 두 자리에서 보여줄 뿐,
// 두 벌로 만들지는 않는다** (값은 늘 한 스토어에만 있다).
//
// ── 안 되는 것은 안 그린다 ──
//
// 목소리로 적기는 크롬 계열에서만 되고, 숨은 마이크가 있어야 한다.
// **눌러도 아무 일이 안 일어나는 스위치를 두지 않는다** — 안 되는 자리에서는
// 까닭을 적거나 아예 안 그린다.

/** 켜고 끄는 한 줄. */
function Toggle({ title, desc, on, onChange, disabled, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '11px 0', borderTop: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: disabled ? 'var(--text-muted)' : 'var(--text-primary)' }}>{title}</div>
        {desc && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 2 }}>{desc}</div>
        )}
        {children}
      </div>
      <button
        onClick={() => !disabled && onChange(!on)}
        disabled={disabled}
        role="switch"
        aria-checked={!!on}
        aria-label={title}
        style={{
          flexShrink: 0, width: 44, height: 25, borderRadius: 13, marginTop: 2,
          position: 'relative', cursor: disabled ? 'default' : 'pointer',
          border: `1px solid ${on ? 'var(--accent)' : 'var(--border-hover)'}`,
          background: on ? 'var(--accent-dim)' : 'var(--bg-primary)',
          opacity: disabled ? 0.45 : 1,
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: on ? 21 : 2,
          width: 19, height: 19, borderRadius: '50%',
          background: on ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'left 0.15s',
        }} />
      </button>
    </div>
  );
}

/** 몇 개 중 하나 고르기. */
function Pick({ items, value, onPick, idOf = (x) => x.id, nameOf = (x) => x.name }) {
  return (
    <div className="filter-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {items.map((it) => {
        const id = idOf(it);
        const on = String(id) === String(value);
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            aria-pressed={on}
            style={{
              minHeight: 34, padding: '6px 12px', borderRadius: 6, fontSize: 12,
              fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border-hover)'}`,
              background: on ? 'var(--accent-dim)' : 'none',
              color: on ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >{nameOf(it)}</button>
        );
      })}
    </div>
  );
}

/** 무리 하나. */
function Group({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 11.5, letterSpacing: 1.8,
        color: 'var(--accent)', marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  );
}

/** 다른 화면으로 보내는 한 줄. 지금 값을 같이 적는다. */
function GoRow({ title, sub, warn, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '11px 0', borderTop: '1px solid var(--border)',
        background: 'none', border: 'none', borderTop: '1px solid var(--border)',
        fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{title}</span>
      {sub && (
        <span style={{ fontSize: 11.5, color: warn ? 'var(--warning)' : 'var(--text-muted)' }}>· {sub}</span>
      )}
      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>›</span>
    </button>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [lockOpen, setLockOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [nickEdit, setNickEdit] = useState(false);
  const [nickDraft, setNickDraft] = useState('');
  const [savingNick, setSavingNick] = useState(false);

  // 휴식 타이머 여섯은 **그쪽 스토어를 그대로 쓴다.** 옮기면 두 벌이 된다
  const rest = useRestTimerStore();
  const s = useSettingsStore();
  const sex = useAuthStore((st) => st.sex);
  const setSex = useAuthStore((st) => st.setSex);
  const nickname = useAuthStore((st) => st.nickname);

  // 이름 바꾸기. 계정 시트가 하던 것과 **같은 길**을 쓴다 (`PUT /auth/nickname`) —
  // 화면이 둘이어도 서버로 가는 길은 하나다
  const saveNick = () => {
    const trimmed = String(nickDraft || '').trim();
    if (!trimmed || savingNick) return;
    setSavingNick(true);
    client.put('/auth/nickname', { nickname: trimmed })
      .then(() => {
        useAuthStore.setState({ nickname: trimmed });
        try { localStorage.setItem('nickname', trimmed); } catch { /* 막아둔 브라우저 */ }
        setNickEdit(false);
        toast('이름이 바뀌었어요');
      })
      .catch((err) => toast(err.response?.data?.error || '이름을 바꾸지 못했어요', 'error'))
      .finally(() => setSavingNick(false));
  };

  const tone = TONES.find((t) => t.id === rest.tone) || TONES[0];
  const locked = canLock();

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        설정
      </div>

      {/* ── 소리 ── */}
      <Group title="소리">
        <Toggle
          title="끝나면 소리로 알리기"
          desc="폰이 무음이면 소리가 안 나요 — 진동도 같이 켜두세요"
          on={rest.sound}
          onChange={rest.setSound}
        />

        {/* 소리를 끈 사람에게는 고를 것을 안 보여준다 — 눌러도 아무 일이 안 일어난다 */}
        {rest.sound && (
          <>
            <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>어떤 소리로</div>
              {/* **고르면 그 자리에서 들려준다.** 이름(「종」·「나무」)만으로는 아무도 모른다 */}
              <Pick items={TONES} value={rest.tone} onPick={(id) => { rest.setTone(id); previewTone(id, rest.volume); }} />
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 7 }}>
                {tone.name} — {tone.desc}
              </div>
            </div>

            <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>소리 크기</div>
              <Pick items={VOLUMES} value={rest.volume} onPick={(id) => { rest.setVolume(id); previewTone(rest.tone, id); }} />
            </div>
          </>
        )}

        <Toggle
          title="진동"
          desc="아이폰 사파리는 진동이 없어요"
          on={rest.vibrate}
          onChange={rest.setVibrate}
        />
      </Group>

      {/* ── 쉴 때 ── */}
      <Group title="쉴 때">
        <Toggle
          title="세트를 적으면 타이머가 저절로"
          on={rest.autoStart}
          onChange={rest.setAutoStart}
        />
        <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>기본 휴식 시간</div>
          <Pick
            items={PRESETS.map((n) => ({ id: n, name: `${n}초` }))}
            value={rest.duration}
            onPick={rest.setDuration}
          />
        </div>
      </Group>

      {/* ── 마이크 ──
          **되는 곳에서만 그린다.** 마이크가 없는 브라우저에 스위치만 띄워두면
          눌러보고 아무 일도 안 일어난다 */}
      {(micSupported() || speechSupported()) && (
        <Group title="마이크">
          {micSupported() && (
            <>
              <Toggle
                title="숨 보고 쉬기"
                desc="숨이 아직 올라있으면 쉬는 시간을 몇 초 더 드려요. 소리 크기만 재고 녹음하지 않아요 — 어디로도 안 보냅니다."
                on={s.breath}
                onChange={s.setBreath}
              />

              {s.breath && (
                <>
                  <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>어디서 쓸까요</div>
                    <Pick items={BREATH_WHERE} value={s.breathWhere} onPick={s.setBreathWhere} />
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 7 }}>
                      헬스장은 시끄러워서 숨이 묻혀요
                    </div>
                  </div>

                  <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>얼마나 더 줄까요</div>
                    <Pick items={BREATH_MAX} value={s.breathMax} onPick={s.setBreathMax} />
                  </div>

                  <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>얼마나 예민하게</div>
                    <Pick items={BREATH_SENSE} value={s.breathSense} onPick={s.setBreathSense} />
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 7 }}>
                      예민할수록 자주 늘려줘요. 옷 스치는 소리에도 반응할 수 있어요
                    </div>
                  </div>

                  {/* **여기가 이 화면의 핵심이다.** 마이크는 켜봐야 되는지 아는데,
                      여태 판을 시작해 45초를 버텨야 확인이 됐다 */}
                  <BreathCheck sense={s.breathSense} />
                </>
              )}
            </>
          )}

          {speechSupported() && (
            <Toggle
              title="목소리로 세트 적기"
              desc="「팔십 여덟개」 한마디로 칸을 채워요"
              on={s.voiceLog}
              onChange={s.setVoiceLog}
            />
          )}
        </Group>
      )}

      {/* ── 운동할 때 ── */}
      <Group title="운동할 때">
        <Toggle
          title="화면 켜두기"
          desc="40초 플랭크 중에 화면이 꺼지면 남은 시간을 못 봐요. 배터리를 더 씁니다."
          on={s.keepAwake}
          onChange={s.setKeepAwake}
        />
        <Toggle
          title="최고 기록이면 알려주기"
          desc="그 종목에서 제일 무거운 것을 들면 그 자리에서 띄워요"
          on={s.prBanner}
          onChange={s.setPrBanner}
        />
        <Toggle
          title="끝나면 오늘 한 것 보여주기"
          desc="루틴을 다 돌면 한 장으로 정리해줘요"
          on={s.finishCard}
          onChange={s.setFinishCard}
        />
      </Group>

      {/* ── 몸 ── */}
      <Group title="몸">
        <div style={{ padding: '11px 0 0' }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>성별</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 2 }}>
            인바디 참고 범위를 그리는 데만 써요. 안 밝히면 숫자만 보여드려요.
          </div>
          <Pick
            items={[{ id: 'male', name: '남' }, { id: 'female', name: '여' }, { id: '', name: '안 밝힘' }]}
            value={sex || ''}
            onPick={(id) => {
              setSex(id || null)
                .then(() => toast('바꿨어요'))
                .catch(() => toast('못 바꿨어요. 잠시 뒤 다시 해주세요'));
            }}
          />
        </div>
      </Group>

      {/* ── 계정 (2026-09-22) ──
          계정 시트에만 있던 것들을 여기서도 한다. **길은 하나다** — 이름은 같은
          서버 길로 가고, 비밀번호와 삭제는 계정 시트가 쓰는 그 모달을 그대로 연다 */}
      <Group title="계정">
        <div style={{ padding: '11px 0 0' }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>이름</div>
          {nickEdit ? (
            <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
              <input
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNick(); }}
                maxLength={20}
                autoFocus
                style={{
                  flex: 1, minWidth: 0, minHeight: 38, padding: '8px 11px',
                  background: 'var(--bg-primary)', border: '1px solid var(--border-hover)',
                  borderRadius: 6, color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit',
                }}
              />
              <button
                onClick={saveNick}
                disabled={savingNick}
                className="btn-primary"
                style={{ width: 'auto', padding: '0 14px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}
              >저장</button>
              <button
                onClick={() => setNickEdit(false)}
                className="btn-secondary"
                style={{ width: 'auto', padding: '0 12px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}
              >취소</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{nickname || '이름 없음'}</span>
              <button
                onClick={() => { setNickDraft(nickname || ''); setNickEdit(true); }}
                className="btn-secondary"
                style={{ width: 'auto', marginLeft: 'auto', padding: '5px 12px', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer' }}
              >바꾸기</button>
            </div>
          )}
        </div>

        <GoRow title="비밀번호 바꾸기" onClick={() => setPwOpen(true)} />
        {/* 프로필 사진은 **계정 시트에 그대로 둔다.** 거기서 아바타를 누르면 바로
            고르는 자리가 열린다 — 사진을 바꾸는 사람은 제 얼굴을 보면서 바꾼다.
            여기서는 **어디로 가면 되는지**만 적는다 (길을 두 벌로 만들지 않는다) */}
        <div style={{
          padding: '11px 0 0', borderTop: '1px solid var(--border)', marginTop: 11,
          fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6,
        }}>
          프로필 사진은 머리 오른쪽의 <b style={{ color: 'var(--text-secondary)' }}>내 이름</b>을
          누르면 바꿀 수 있어요.
        </div>
      </Group>

      {/* ── 잠금과 알림 ──
          **길만 내지 않는다.** 앱 잠금은 여기서 바로 열고, 알림은 왜 안 되는지 적는다 */}
      <Group title="잠금과 알림">
        <GoRow
          title="앱 잠금"
          sub={locked ? '켜짐' : '꺼짐'}
          onClick={() => setLockOpen(true)}
        />
        <GoRow
          title="운동 알림"
          sub="시간 정하기"
          onClick={() => navigate('/reminders')}
        />
      </Group>

      {/* ── 기록 챙기기 ── */}
      <Group title="기록 챙기기">
        <GoRow
          title="내려받기 · 가져오기"
          sub="운동 · 인바디 · 측정"
          onClick={() => navigate('/support', { state: { tab: 'data' } })}
        />
      </Group>

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 4, marginBottom: 18 }}>
        여기 있는 것은 <b>이 기기에서 어떻게 쓸지</b>예요 — 로그아웃해도 남습니다.
        이름 · 성별만 서버에 있어서 기기를 바꿔도 따라갑니다.
      </div>

      {/* ── 나가기 ──
          **맨 아래에 둔다.** 설정을 보다가 잘못 누를 자리가 아니다.
          나가기 전에 줄에 남은 기록을 올린다 — 그 일은 `data/leaveApp.js` 가 한다 */}
      <button
        onClick={async () => { if (await leaveApp()) navigate('/login'); }}
        className="btn-secondary"
        style={{ width: '100%', minHeight: 44, fontFamily: 'inherit', cursor: 'pointer' }}
      >로그아웃</button>

      {/* 계정 삭제는 **되돌리기 어려운 일**이라 로그아웃과 붙여두되 색으로 가른다.
          30일 안에 다시 로그인하면 되살아난다는 것은 모달이 적는다 */}
      <button
        onClick={() => setDelOpen(true)}
        style={{
          width: '100%', minHeight: 40, marginTop: 8, borderRadius: 'var(--radius)',
          background: 'none', border: '1px solid var(--border)',
          color: 'var(--text-muted)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer',
        }}
      >계정 삭제</button>

      {lockOpen && <LockSetup onClose={() => setLockOpen(false)} />}
      {pwOpen && <PasswordChangeModal onClose={() => setPwOpen(false)} onChanged={() => setPwOpen(false)} />}
      {delOpen && (
        <AccountDeleteModal
          onClose={() => setDelOpen(false)}
          onDeleted={() => { setDelOpen(false); navigate('/login'); }}
        />
      )}
    </div>
  );
}
