import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// 운동 사전 (세부 종류 + 설명 포함)
const EXERCISE_DICT = [
  // ─── 벤치프레스 종류 ───
  { ko: '벤치프레스', en: 'bench press', group: '벤치프레스', desc: '평평한 벤치에서 바벨을 밀어올림. 가슴 중앙부 전체 자극' },
  { ko: '인클라인 벤치프레스', en: 'incline bench press', group: '벤치프레스', desc: '벤치를 30~45도 올려서 수행. 가슴 상부(쇄골부) 집중' },
  { ko: '디클라인 벤치프레스', en: 'decline bench press', group: '벤치프레스', desc: '벤치를 15~30도 내려서 수행. 가슴 하부 집중' },
  { ko: '클로즈그립 벤치프레스', en: 'close grip bench press', group: '벤치프레스', desc: '손 간격을 좁게 잡고 수행. 삼두근 + 가슴 안쪽 집중' },
  { ko: '덤벨 벤치프레스', en: 'dumbbell bench press', group: '벤치프레스', desc: '덤벨 사용. 가동범위가 넓고 좌우 균형 발달에 좋음' },
  { ko: '인클라인 덤벨프레스', en: 'incline dumbbell press', group: '벤치프레스', desc: '인클라인 벤치 + 덤벨. 가슴 상부 + 넓은 가동범위' },
  { ko: '스미스머신 벤치프레스', en: 'smith machine bench press', group: '벤치프레스', desc: '스미스머신 사용. 궤도가 고정되어 초보자에게 안전' },
  { ko: '플로어프레스', en: 'floor press', group: '벤치프레스', desc: '바닥에 누워서 수행. 어깨 부담 적고 삼두 자극 강함' },

  // ─── 스쿼트 종류 ───
  { ko: '스쿼트', en: 'squat', group: '스쿼트', desc: '바벨을 등에 메고 앉았다 일어남. 하체 운동의 왕' },
  { ko: '프론트 스쿼트', en: 'front squat', group: '스쿼트', desc: '바벨을 앞쪽(쇄골)에 올림. 대퇴사두근 + 코어 집중' },
  { ko: '핵스쿼트', en: 'hack squat', group: '스쿼트', desc: '머신 사용. 등 부담 없이 대퇴사두근 집중' },
  { ko: '고블릿 스쿼트', en: 'goblet squat', group: '스쿼트', desc: '덤벨/케틀벨을 가슴 앞에 들고 수행. 초보자 입문용' },
  { ko: '불가리안 스플릿 스쿼트', en: 'bulgarian split squat', group: '스쿼트', desc: '뒷발을 벤치에 올리고 한쪽씩. 좌우 불균형 교정' },
  { ko: '오버헤드 스쿼트', en: 'overhead squat', group: '스쿼트', desc: '바벨을 머리 위로 들고 수행. 전신 안정성 + 유연성 필요' },
  { ko: '점프 스쿼트', en: 'jump squat', group: '스쿼트', desc: '스쿼트 후 점프. 폭발력 + 유산소 효과' },
  { ko: '시시 스쿼트', en: 'sissy squat', group: '스쿼트', desc: '뒤로 기울이며 무릎을 앞으로. 대퇴사두근 고립' },

  // ─── 데드리프트 종류 ───
  { ko: '데드리프트', en: 'deadlift', group: '데드리프트', desc: '바닥에서 바벨을 들어올림. 후면 사슬(등+둔근+햄스트링) 전체' },
  { ko: '컨벤셔널 데드리프트', en: 'conventional deadlift', group: '데드리프트', desc: '일반 데드리프트. 발 어깨 너비, 등 하부 + 둔근 집중' },
  { ko: '스모 데드리프트', en: 'sumo deadlift', group: '데드리프트', desc: '발을 넓게 벌림. 내전근 + 둔근 자극 강화, 허리 부담 적음' },
  { ko: '루마니안 데드리프트', en: 'romanian deadlift', group: '데드리프트', desc: '무릎 살짝 굽히고 엉덩이만 뒤로. 햄스트링 + 둔근 집중' },
  { ko: '스티프레그 데드리프트', en: 'stiff leg deadlift', group: '데드리프트', desc: '무릎 거의 안 굽힘. 햄스트링 스트레칭 극대화' },
  { ko: '트랩바 데드리프트', en: 'trap bar deadlift', group: '데드리프트', desc: '육각 바 사용. 허리 부담 적고 대퇴사두근도 관여' },
  { ko: '디피셋 데드리프트', en: 'deficit deadlift', group: '데드리프트', desc: '발판 위에 서서 수행. 가동범위 늘려 바닥 초반 힘 강화' },

  // ─── 프레스 종류 ───
  { ko: '숄더프레스', en: 'shoulder press', group: '프레스', desc: '어깨 위로 밀어올림. 전면삼각근 + 삼두근' },
  { ko: '오버헤드프레스', en: 'overhead press', group: '프레스', desc: '서서 바벨을 머리 위로. 어깨 전체 + 코어 안정화' },
  { ko: '밀리터리프레스', en: 'military press', group: '프레스', desc: '발 모으고 서서 수행. 오버헤드프레스의 엄격한 버전' },
  { ko: '아놀드프레스', en: 'arnold press', group: '프레스', desc: '덤벨을 회전시키며 올림. 삼각근 전체(전면+측면) 자극' },
  { ko: '덤벨 숄더프레스', en: 'dumbbell shoulder press', group: '프레스', desc: '덤벨 사용. 좌우 독립적으로 움직여 균형 발달' },
  { ko: '푸시프레스', en: 'push press', group: '프레스', desc: '무릎 반동으로 밀어올림. 더 무거운 중량 가능, 폭발력 훈련' },
  { ko: '비하인드넥프레스', en: 'behind the neck press', group: '프레스', desc: '머리 뒤에서 밀어올림. 측면삼각근 자극. 어깨 유연성 필요' },

  // ─── 로우 종류 ───
  { ko: '바벨로우', en: 'barbell row', group: '로우', desc: '상체 숙이고 바벨 당김. 등 중앙부 전체 자극' },
  { ko: '펜들레이로우', en: 'pendlay row', group: '로우', desc: '매 반복 바닥에서 시작. 폭발력 + 등 두께' },
  { ko: '덤벨로우', en: 'dumbbell row', group: '로우', desc: '한 손씩 수행. 광배근 집중 + 좌우 균형' },
  { ko: '시티드 로우', en: 'seated row', group: '로우', desc: '케이블 머신 앉아서 당김. 등 중앙부 + 견갑골' },
  { ko: '케이블 로우', en: 'cable row', group: '로우', desc: '케이블로 당기기. 다양한 그립으로 자극 변경' },
  { ko: '티바 로우', en: 't-bar row', group: '로우', desc: 'T자 바벨 당김. 등 두께 발달에 효과적' },
  { ko: '원암 덤벨로우', en: 'one arm dumbbell row', group: '로우', desc: '벤치에 한 손 짚고 수행. 광배근 고립' },
  { ko: '업라이트로우', en: 'upright row', group: '로우', desc: '바벨을 턱까지 당김. 승모근 + 측면삼각근' },

  // ─── 컬 종류 ───
  { ko: '바이셉컬', en: 'bicep curl', group: '컬', desc: '이두근 기본 운동. 팔꿈치 고정하고 굽히기' },
  { ko: '바벨컬', en: 'barbell curl', group: '컬', desc: '바벨 사용. 양손 동시에 고중량 이두 훈련' },
  { ko: '덤벨컬', en: 'dumbbell curl', group: '컬', desc: '덤벨 사용. 좌우 독립 + 회전 가능' },
  { ko: '해머컬', en: 'hammer curl', group: '컬', desc: '손바닥 마주보는 그립. 이두 + 전완근(상완요골근)' },
  { ko: '프리쳐컬', en: 'preacher curl', group: '컬', desc: '패드에 팔 고정. 이두 하부(짧은두) 집중' },
  { ko: '컨센트레이션컬', en: 'concentration curl', group: '컬', desc: '앉아서 한 팔씩. 이두 피크(봉우리) 만들기' },
  { ko: '인클라인 덤벨컬', en: 'incline dumbbell curl', group: '컬', desc: '인클라인 벤치에 기대어 수행. 이두 장두 스트레칭 극대화' },
  { ko: '케이블 컬', en: 'cable curl', group: '컬', desc: '케이블 사용. 전 구간 일정한 텐션 유지' },

  // ─── 푸시업 종류 ───
  { ko: '푸시업', en: 'push up', group: '푸시업', desc: '기본 맨몸 가슴 운동. 가슴 + 삼두 + 전면삼각근' },
  { ko: '와이드 푸시업', en: 'wide push up', group: '푸시업', desc: '손 넓게. 가슴 바깥쪽 자극 강화' },
  { ko: '다이아몬드 푸시업', en: 'diamond push up', group: '푸시업', desc: '손 모아 다이아몬드. 삼두 + 가슴 안쪽' },
  { ko: '인클라인 푸시업', en: 'incline push up', group: '푸시업', desc: '높은 곳에 손. 난이도 낮아 초보자용' },
  { ko: '디클라인 푸시업', en: 'decline push up', group: '푸시업', desc: '발을 높은 곳에. 가슴 상부 + 어깨 자극 증가' },
  { ko: '파이크 푸시업', en: 'pike push up', group: '푸시업', desc: '엉덩이 높이 올려 역V자. 어깨(삼각근) 집중' },
  { ko: '핸드스탠드 푸시업', en: 'handstand push up', group: '푸시업', desc: '물구나무 서서 수행. 맨몸 최강 어깨 운동' },

  // ─── 기타 개별 운동 ───
  { ko: '풀업', en: 'pull up', group: '풀업', desc: '오버그립으로 바 매달려 당기기. 등 운동의 왕' },
  { ko: '친업', en: 'chin up', group: '풀업', desc: '언더그립. 이두 + 등 동시 자극. 풀업보다 쉬움' },
  { ko: '런지', en: 'lunge', group: '런지', desc: '한 발 앞으로 내딛기. 대퇴사두 + 둔근' },
  { ko: '워킹런지', en: 'walking lunge', group: '런지', desc: '걸으면서 런지. 유산소 + 하체 동시' },
  { ko: '리버스런지', en: 'reverse lunge', group: '런지', desc: '뒤로 내딛기. 무릎 부담 적음' },
  { ko: '플랭크', en: 'plank', group: '코어', desc: '엎드려 버티기. 코어 안정화 기본' },
  { ko: '사이드 플랭크', en: 'side plank', group: '코어', desc: '옆으로 버티기. 복사근 + 코어' },
  { ko: '크런치', en: 'crunch', group: '코어', desc: '윗몸일으키기. 복직근 상부 집중' },
  { ko: '바이시클 크런치', en: 'bicycle crunch', group: '코어', desc: '좌우 비틀기. 복사근 + 복직근 동시' },
  { ko: '레그레이즈', en: 'leg raise', group: '코어', desc: '누워서 다리 들기. 복직근 하부 집중' },
  { ko: '행잉 레그레이즈', en: 'hanging leg raise', group: '코어', desc: '매달려서 다리 들기. 복근 전체 + 그립' },
  { ko: '버피', en: 'burpee', group: '유산소', desc: '전신 유산소 운동. 스쿼트+푸시업+점프 결합' },
  { ko: '딥스', en: 'dips', group: '딥스', desc: '평행봉에서 밀기. 삼두 + 가슴 하부' },
  { ko: '랫풀다운', en: 'lat pulldown', group: '풀다운', desc: '케이블로 바 당기기. 광배근 집중' },
  { ko: '레그프레스', en: 'leg press', group: '하체머신', desc: '머신으로 다리 밀기. 대퇴사두 + 둔근' },
  { ko: '레그컬', en: 'leg curl', group: '하체머신', desc: '머신으로 다리 굽히기. 햄스트링 고립' },
  { ko: '레그 익스텐션', en: 'leg extension', group: '하체머신', desc: '머신으로 다리 펴기. 대퇴사두근 고립' },
  { ko: '케이블 크로스오버', en: 'cable crossover', group: '케이블', desc: '케이블 교차. 가슴 안쪽 수축' },
  { ko: '케이블 플라이', en: 'cable fly', group: '케이블', desc: '케이블로 가슴 모으기. 전 구간 텐션' },
  { ko: '덤벨플라이', en: 'dumbbell fly', group: '플라이', desc: '덤벨로 가슴 벌렸다 모으기. 가슴 스트레칭' },
  { ko: '체스트프레스', en: 'chest press', group: '머신프레스', desc: '머신으로 가슴 밀기. 안전하고 초보자 친화적' },
  { ko: '펙덱', en: 'pec deck', group: '머신플라이', desc: '머신으로 가슴 모으기. 가슴 수축 집중' },
  { ko: '트라이셉 푸시다운', en: 'tricep pushdown', group: '삼두', desc: '케이블 아래로 밀기. 삼두근 기본 운동' },
  { ko: '트라이셉 익스텐션', en: 'tricep extension', group: '삼두', desc: '머리 뒤에서 펴기. 삼두 장두 스트레칭' },
  { ko: '스컬크러셔', en: 'skull crusher', group: '삼두', desc: '누워서 이마 쪽으로 내림. 삼두 전체 자극' },
  { ko: '레터럴 레이즈', en: 'lateral raise', group: '레이즈', desc: '옆으로 들기. 측면삼각근 고립' },
  { ko: '사이드레이즈', en: 'lateral raise', group: '레이즈', desc: '레터럴 레이즈와 동일. 어깨 옆면' },
  { ko: '프론트레이즈', en: 'front raise', group: '레이즈', desc: '앞으로 들기. 전면삼각근 고립' },
  { ko: '리어델트 플라이', en: 'rear delt fly', group: '레이즈', desc: '뒤로 벌리기. 후면삼각근 고립' },
  { ko: '리어델트', en: 'rear delt', group: '레이즈', desc: '어깨 뒤쪽 운동 통칭' },
  { ko: '페이스풀', en: 'face pull', group: '레이즈', desc: '케이블을 얼굴 쪽으로 당기기. 후면삼각근 + 회전근개' },
  { ko: '슈러그', en: 'shrug', group: '승모근', desc: '어깨를 귀 쪽으로 으쓱. 승모근 상부' },
  { ko: '힙쓰러스트', en: 'hip thrust', group: '둔근', desc: '등 기대고 엉덩이 들기. 둔근 최고 운동' },
  { ko: '글루트브릿지', en: 'glute bridge', group: '둔근', desc: '누워서 엉덩이 들기. 힙쓰러스트 초급 버전' },
  { ko: '카프레이즈', en: 'calf raise', group: '종아리', desc: '발끝으로 서기. 종아리(비복근) 고립' },
  { ko: '케틀벨 스윙', en: 'kettlebell swing', group: '전신', desc: '케틀벨 흔들기. 둔근 + 햄스트링 + 유산소' },
  { ko: '마운틴 클라이머', en: 'mountain climber', group: '유산소', desc: '플랭크 자세로 다리 교차. 코어 + 유산소' },
  { ko: '점핑잭', en: 'jumping jack', group: '유산소', desc: '팔다리 벌렸다 모으기. 워밍업 + 유산소' },
  { ko: '하이니', en: 'high knees', group: '유산소', desc: '제자리 높이 뛰기. 심박수 폭발' },
  { ko: '슈퍼맨', en: 'superman', group: '코어', desc: '엎드려 팔다리 들기. 척추기립근 강화' },
  { ko: '인버티드 로우', en: 'inverted row', group: '로우', desc: '바 아래서 당기기. 맨몸 등 운동' },
  { ko: '굿모닝', en: 'good morning', group: '햄스트링', desc: '바벨 메고 인사하듯 숙이기. 햄스트링 + 척추기립근' },
  { ko: '힙어브덕션', en: 'hip abduction', group: '둔근', desc: '다리 바깥으로 벌리기. 중둔근 고립' },
];

const CATEGORY_DICT = {
  '가슴': 'chest', '등': 'back', '어깨': 'shoulder', '하체': 'leg', '팔': 'arm',
  '이두': 'bicep', '삼두': 'tricep', '복근': 'abs', '코어': 'core',
  '둔근': 'glute', '햄스트링': 'hamstring', '종아리': 'calf', '전완': 'forearm',
  '승모근': 'trapezius', '광배근': 'latissimus',
};

function isKorean(text) { return /[가-힣]/.test(text); }

function translateQuery(query) {
  const trimmed = query.trim();
  if (CATEGORY_DICT[trimmed]) return CATEGORY_DICT[trimmed];
  const noSpace = trimmed.replace(/\s+/g, '');
  const exact = EXERCISE_DICT.find(e => e.ko === trimmed || e.ko.replace(/\s+/g, '') === noSpace);
  if (exact) return exact.en;
  const partial = EXERCISE_DICT.find(e => trimmed.includes(e.ko) || e.ko.includes(trimmed));
  if (partial) return partial.en;
  for (const [kr, en] of Object.entries(CATEGORY_DICT)) {
    if (trimmed.includes(kr)) return en;
  }
  return query;
}

function findKoreanName(enName) {
  if (!enName) return null;
  const lower = enName.toLowerCase();
  const match = EXERCISE_DICT.find(e => lower.includes(e.en) || e.en.includes(lower));
  return match ? match.ko : null;
}

// 관련 종류 찾기 (같은 group)
function findVariations(query) {
  const trimmed = query.trim().replace(/\s+/g, '');
  // 입력어가 포함된 운동 찾기
  const match = EXERCISE_DICT.find(e =>
    e.ko.replace(/\s+/g, '') === trimmed ||
    e.ko.includes(query.trim()) ||
    query.trim().includes(e.ko)
  );
  if (!match) return [];
  // 같은 그룹의 모든 운동 반환
  return EXERCISE_DICT.filter(e => e.group === match.group);
}

const CATEGORIES = [
  { key: 'chest', label: '가슴', en: 'chest' },
  { key: 'back', label: '등', en: 'back' },
  { key: 'shoulders', label: '어깨', en: 'shoulders' },
  { key: 'legs', label: '하체', en: 'legs' },
  { key: 'arms', label: '팔', en: 'arms' },
  { key: 'core', label: '코어', en: 'core' },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState('auto');
  const [results, setResults] = useState([]);
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [translated, setTranslated] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setTranslated('');
    setVariations([]);

    let searchTerm = query.trim();

    // 한국어면 세부 종류 찾기
    if (lang === 'ko' || (lang === 'auto' && isKorean(searchTerm))) {
      const vars = findVariations(searchTerm);
      if (vars.length > 1) setVariations(vars);

      const en = translateQuery(searchTerm);
      if (en !== searchTerm) {
        setTranslated(en);
        searchTerm = en;
      }
    }

    try {
      const { data } = await axios.get(
        `https://wger.de/api/v2/exercise/search/?term=${encodeURIComponent(searchTerm)}&language=english&format=json`,
        { timeout: 8000 }
      );
      setResults(data.suggestions || []);
    } catch {
      setError('검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (cat) => {
    setQuery(cat.en);
    setActiveCategory(cat.key);
    // Trigger search programmatically
    setTimeout(() => {
      setLoading(true);
      setError('');
      setTranslated('');
      setVariations([]);
      axios.get(
        `https://wger.de/api/v2/exercise/search/?term=${encodeURIComponent(cat.en)}&language=english&format=json`,
        { timeout: 8000 }
      )
        .then(({ data }) => setResults(data.suggestions || []))
        .catch(() => setError('검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.'))
        .finally(() => setLoading(false));
    }, 0);
  };

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        운동 검색
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        한국어 또는 영어로 운동을 검색하세요
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { value: 'auto', label: '자동 감지' },
          { value: 'ko', label: '한국어' },
          { value: 'en', label: 'English' },
        ].map((l) => (
          <button
            key={l.value}
            className={`btn-secondary${lang === l.value ? ' active' : ''}`}
            onClick={() => setLang(l.value)}
            style={{ fontSize: 11, padding: '4px 12px' }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          className="input"
          placeholder={lang === 'en' ? 'bench press, squat...' : '벤치프레스, 스쿼트, bench press...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={loading} style={{ width: 'auto', padding: '11px 20px' }}>
          {loading ? '...' : '검색'}
        </button>
      </form>

      {/* 부위별 카테고리 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`btn-secondary${activeCategory === cat.key ? ' active' : ''}`}
            onClick={() => handleCategoryClick(cat)}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {translated && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          🔄 "<span style={{ color: 'var(--accent)' }}>{translated}</span>" (으)로 검색됨
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
          {error}
          <button
            onClick={handleSearch}
            style={{
              marginLeft: 8, background: 'none', border: '1px solid var(--danger)',
              color: 'var(--danger)', padding: '2px 10px', borderRadius: 'var(--radius)',
              cursor: 'pointer', fontSize: 12,
            }}
          >재시도</button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          외부 운동 DB 검색 중... (최대 8초)
        </div>
      )}

      {/* 세부 종류 카드 */}
      {variations.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-title">
            <div className="accent-bar" />
            {variations[0].group} 종류 ({variations.length}가지)
          </div>
          {variations.map((v) => (
            <div
              key={v.ko}
              className="card clickable"
              style={{ marginBottom: 6 }}
              onClick={() => navigate('/workout', { state: { exercise: v.ko } })}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1.5 }}>
                    {v.ko}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {v.en}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                    {v.desc}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API 검색 결과 */}
      {results.length > 0 && (
        <div className="section-title">
          <div className="accent-bar" />
          검색 결과
        </div>
      )}

      {results.length === 0 && !loading && query && variations.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-title">검색 결과 없음</div>
          <div className="empty-state-desc">검색 결과가 없어요. 다른 키워드로 시도해보세요</div>
        </div>
      )}

      {results.map((item) => {
        const enName = item.data?.name || '';
        const koName = findKoreanName(enName);

        return (
          <div
            key={item.data?.id || enName}
            className="card clickable"
            style={{ marginBottom: 8 }}
            onClick={() => navigate('/workout', { state: { exercise: koName || enName } })}
          >
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5 }}>
              {enName}
            </div>
            {koName && (
              <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 2 }}>
                ({koName})
              </div>
            )}
            {item.data?.category && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {item.data.category}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
