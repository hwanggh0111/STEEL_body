import { useNavigate, useSearchParams } from 'react-router-dom';
import ExerciseFinder from '../components/ExerciseFinder';

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
      />
    </div>
  );
}
