// 운동 사전.
//
// 예전에는 이 목록이 SearchPage 안에 있으면서 **번역에만 쓰였다.** 한국어를 영어로
// 바꿔서 외부 DB(wger.de)에 8초 물어보고, 영어 이름만 설명 없이 돌려줬다.
// **좋은 자료가 바로 여기 있는데 버리고 더 나쁜 것을 기다린 셈이다.**
//
// 이제 검색은 이 사전을 먼저 본다. 외부 DB 는 여기서 못 찾았을 때만, 그것도
// 눌러야 나간다. 한국어 이름 · 영어 이름 · 설명 · 같은 갈래까지 다 여기 있다.

export const EXERCISE_DICT = [
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
  // ─── 집에서 기구 없이 (홈트 프로그램이 쓰는 것들) ───
  // 홈트 여섯 판(`data/homeworkoutPrograms.js`)이 부르는 이름은 여기에도 있어야 한다.
  // 없으면 홈트에서 본 이름을 검색창에 쳤을 때 조용히 빈손이 된다 — 아무도 안 터진다.
  // `npm run check` 가 두 파일을 맞춰본다
  { ko: '니 푸시업', en: 'knee push up', group: '푸시업', desc: '무릎을 대고 하는 푸시업. 푸시업이 아직 안 될 때의 첫 단계' },
  { ko: '스캡 푸시업', en: 'scapular push up', group: '푸시업', desc: '팔은 편 채 견갑만 모았다 벌림. 어깨를 붙잡아주는 전거근' },
  { ko: '푸시업 보텀 홀드', en: 'push up bottom hold', group: '푸시업', desc: '푸시업 맨 아래에서 버티기. 제일 힘든 구간을 붙잡는다' },
  { ko: '수건 로우', en: 'towel row', group: '로우', desc: '문고리에 수건을 걸고 몸을 뒤로 기울여 당김. 기구 없이 하는 등 운동' },
  { ko: '수건 페이스풀', en: 'towel face pull', group: '레이즈', desc: '수건을 얼굴 쪽으로 당김. 말린 어깨를 뒤로 펴는 자리' },
  { ko: '리버스 스노우엔젤', en: 'reverse snow angel', group: '레이즈', desc: '엎드려 팔을 바닥에 쓸며 위아래로. 등 상부와 후면 어깨' },
  { ko: '월 핸드스탠드 홀드', en: 'wall handstand hold', group: '프레스', desc: '벽에 발을 걸고 물구나무로 버티기. 어깨로 몸무게를 받는다' },
  { ko: '굿모닝 (맨몸)', en: 'bodyweight good morning', group: '햄스트링', desc: '무게 없이 인사하듯 숙이기. 햄스트링을 데우는 자리' },
  { ko: '의자 스쿼트', en: 'box squat', group: '스쿼트', desc: '의자에 살짝 앉았다 일어섬. 앉는 깊이를 의자가 정해준다' },
  { ko: '코사크 스쿼트', en: 'cossack squat', group: '스쿼트', desc: '다리를 넓게 벌리고 한쪽으로 앉음. 내전근 + 고관절 가동범위' },
  { ko: '피스톨 스쿼트', en: 'pistol squat', group: '스쿼트', desc: '한 발로 앉았다 일어섬. 맨몸 하체의 마지막 단계' },
  { ko: '스텝업', en: 'step up', group: '둔근', desc: '의자나 계단에 한 발로 올라섬. 둔근 + 균형' },
  { ko: '싱글 레그 글루트브릿지', en: 'single leg glute bridge', group: '둔근', desc: '한 다리로 엉덩이 들기. 좌우 차이가 바로 드러난다' },
  { ko: '노르딕 컬', en: 'nordic curl', group: '햄스트링', desc: '발을 고정하고 천천히 앞으로 넘어감. 햄스트링 신장성 수축' },
  { ko: '런지 홀드', en: 'lunge hold', group: '런지', desc: '런지 자세로 버티기. 앞다리 · 균형 · 코어를 같이 쓴다' },
  { ko: '싱글 레그 카프레이즈', en: 'single leg calf raise', group: '종아리', desc: '한 발로 뒤꿈치 들기. 종아리에 제 몸무게를 다 준다' },
  { ko: '버드독', en: 'bird dog', group: '코어', desc: '네발기기에서 팔다리 교차로 뻗기. 허리를 흔들지 않고 버티는 연습' },
  { ko: '프론 코브라', en: 'prone cobra', group: '코어', desc: '엎드려 가슴과 팔을 들어 버티기. 등 상부 · 척추기립근' },
  { ko: '플랭크 업다운', en: 'plank up down', group: '코어', desc: '팔꿈치와 손을 번갈아. 흔들리지 않게 버티는 것이 핵심' },
  { ko: '리버스 크런치', en: 'reverse crunch', group: '코어', desc: '누워서 골반을 말아 올림. 복직근 하부' },
  { ko: '러시안 트위스트', en: 'russian twist', group: '코어', desc: '앉아서 좌우로 비틀기. 복사근' },
  { ko: '힐 터치', en: 'heel touch', group: '코어', desc: '누워서 좌우 발뒤꿈치 터치. 옆구리를 짧게 자주 쓴다' },
  { ko: '사이드 플랭크 힙 딥', en: 'side plank hip dip', group: '코어', desc: '사이드 플랭크에서 엉덩이를 내렸다 올림. 버티기보다 세다' },
  { ko: 'V업', en: 'v up', group: '코어', desc: '누워서 팔다리를 동시에 들어 V자. 복근 전체' },
  { ko: '슈퍼맨 스윔', en: 'superman swim', group: '코어', desc: '엎드려 팔다리를 교차로 저음. 슈퍼맨을 움직이며 하는 판' },
  { ko: '스탠딩 니업', en: 'standing knee up', group: '유산소', desc: '서서 무릎을 번갈아 올림. 뛰지 않는 유산소' },
  { ko: '사이드 스텝 터치', en: 'side step touch', group: '유산소', desc: '좌우로 스텝하며 손으로 터치. 착지 소리가 안 난다' },
  { ko: '섀도 복싱', en: 'shadow boxing', group: '유산소', desc: '제자리에서 펀치. 소리 없이 심박수를 올린다' },
  { ko: '크로스 잭', en: 'cross jack', group: '유산소', desc: '점핑잭을 팔다리 교차로. 점프가 들어간다' },
  { ko: '스쿼트 펀치', en: 'squat punch', group: '유산소', desc: '앉았다 일어서며 펀치. 하체 + 숨' },
  { ko: '플랭크 잭', en: 'plank jack', group: '유산소', desc: '플랭크로 버티며 다리만 벌렸다 모음. 코어 + 유산소' },
  { ko: '하프 버피', en: 'half burpee', group: '유산소', desc: '버피에서 푸시업과 점프를 뺀 것. 무릎 부담이 적다' },
  { ko: '스쿼트 사이드킥', en: 'squat side kick', group: '유산소', desc: '일어서며 옆으로 차기. 둔근 바깥쪽 + 균형' },
  { ko: '인치웜', en: 'inchworm', group: '전신', desc: '선 채로 손을 짚어 플랭크까지 걸어갔다 돌아옴. 전신을 한 번에 편다' },
  { ko: '스프롤', en: 'sprawl', group: '유산소', desc: '버피에서 점프를 뺀 레슬링식 동작. 소리가 안 난다' },
  // ─── 기능성(특수부대식) — 추천 루틴에서 온 것들 ───
  // 홈트의 여섯째 판이 부르는 이름이다. 설명은 루틴(`backend/src/routes/routines.js`)에
  // 이미 적어둔 것을 한 줄로 줄였다 — 두 곳이 같은 동작을 다르게 설명하면 안 된다
  { ko: '배낭 파머스 워크', en: 'backpack farmer walk', group: '전신', desc: '책 넣은 배낭이나 장바구니를 양손에 들고 걷기. 그립 + 코어 + 자세' },
  { ko: '오버헤드 배낭 워크', en: 'overhead backpack walk', group: '전신', desc: '가벼운 배낭을 머리 위로 든 채 걷기. 허리가 젖혀지지 않게 배에 힘' },
  { ko: '배낭 안고 런지 워크', en: 'backpack lunge walk', group: '런지', desc: '배낭을 가슴 앞에 안고 걸으며 런지. 좁으면 제자리에서 좌우 번갈아' },
  { ko: '배낭 스러스터', en: 'backpack thruster', group: '전신', desc: '배낭을 안고 앉았다 일어서며 머리 위로 밀어 올림. 제일 빨리 숨이 찬다' },
  { ko: '데드행', en: 'dead hang', group: '풀업', desc: '문틀바에 팔을 편 채 매달려 버티기. 그립 + 어깨' },
  { ko: '월싯', en: 'wall sit', group: '스쿼트', desc: '벽에 등을 붙이고 무릎 90도로 버티기. 소리도 자리도 안 난다' },
  { ko: '할로우 홀드', en: 'hollow hold', group: '코어', desc: '누워서 어깨와 다리를 함께 들어 바나나 모양. 허리가 뜨면 다리를 더 든다' },
  { ko: '플랭크 어깨 터치', en: 'plank shoulder tap', group: '코어', desc: '높은 플랭크에서 반대쪽 어깨 짚기. 골반이 흔들리지 않게 버틴다' },
  { ko: '하이니 스프린트', en: 'high knee sprint', group: '유산소', desc: '무릎을 배꼽 높이까지 올리며 제자리 전력 질주. 앞꿈치로 디디면 소리가 덜 난다' },
];

export const CATEGORY_DICT = {
  '가슴': 'chest', '등': 'back', '어깨': 'shoulder', '하체': 'leg', '팔': 'arm',
  '이두': 'bicep', '삼두': 'tricep', '복근': 'abs', '코어': 'core',
  '둔근': 'glute', '햄스트링': 'hamstring', '종아리': 'calf', '전완': 'forearm',
  '승모근': 'trapezius', '광배근': 'latissimus',
};

// 공백·기호를 지운 소문자. '벤치 프레스' 와 '벤치프레스' 는 같은 말이다
const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');

// 한글 초성. '벤치프레스' 를 'ㅂㅊㅍㄹㅅ' 로 찾을 수 있게 한다 (홈 검색과 같은 방식)
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function chosung(str) {
  return [...String(str || '')].map(c => {
    const code = c.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return c;
    return CHO[Math.floor(code / 588)];
  }).join('');
}

/**
 * 사전에서 찾는다. 한 글자로는 안 찾는다 — 거의 다 걸려서 도움이 안 된다.
 *
 * 점수는 어디서 맞았는지로 매긴다. 이름이 그대로 맞은 것이 설명에 스친 것보다 위다.
 * 부위 이름('가슴')으로도 찾을 수 있게 설명까지 본다 — 설명에 부위가 적혀 있다.
 */
export function searchExercises(query, limit = 30) {
  // **부위 이름은 한 글자여도 찾는다.** 「등」 · 「팔」이 한 글자라 아래의 두 글자
  // 규칙에 걸려 아무것도 안 나오고 있었다. 그리고 부위는 글자로 찾을 것이 아니라
  // 갈래로 거를 것이다 — 설명에 「가슴 앞에 들고」가 있다고 가슴 운동은 아니다
  if (isPart(query)) return byCategory(query).slice(0, limit);

  const q = norm(query);
  if (q.length < 2) return [];

  return EXERCISE_DICT
    .map(e => {
      const ko = norm(e.ko);
      const en = norm(e.en);
      let score = 0;
      if (ko === q || en === q) score = 100;
      else if (ko.startsWith(q) || en.startsWith(q)) score = 60;
      else if (ko.includes(q) || en.includes(q)) score = 40;
      else if (chosung(e.ko).includes(q)) score = 30;
      else if (norm(e.group).includes(q)) score = 20;
      else if (norm(e.desc).includes(q)) score = 10;
      return { e, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.e.ko.localeCompare(b.e.ko))
    .slice(0, limit)
    .map(r => r.e);
}

/** 같은 갈래의 운동들 (벤치프레스 → 인클라인 · 디클라인 …). 자기 자신은 뺀다. */
export function siblingsOf(exercise) {
  if (!exercise?.group) return [];
  return EXERCISE_DICT.filter(e => e.group === exercise.group && e.ko !== exercise.ko);
}

// ── 부위 ──
//
// **부위 단추가 「등」과 「팔」에서 아무것도 못 찾고 있었다** (2026-09-02).
// 단추가 검색창에 그 글자를 넣는 식이었는데, 사전 검색은 **한 글자로는 안 찾는다**
// (거의 다 걸려서 도움이 안 되기 때문이다). 「등」 · 「팔」은 한 글자다.
//
// 그리고 두 글자짜리도 제대로 찾은 것이 아니었다. 설명(`desc`)에 그 글자가 들어 있으면
// 걸렸기 때문에 **「가슴」에 고블릿 스쿼트**(「덤벨을 가슴 앞에 들고」)가, **「어깨」에
// 데드행**이 떴다. 글자를 찾은 것이지 부위를 찾은 것이 아니었다.
//
// 이제 **갈래(`group`)에서 부위를 뽑는다.** 갈래는 사람이 적어둔 것이라 설명 글자보다
// 믿을 만하고, 사전의 운동이 하나도 빠짐없이 어느 한 부위에 들어간다.
export const PARTS = ['가슴', '등', '어깨', '하체', '팔', '코어', '전신 · 유산소'];

const PART_OF_GROUP = {
  // 가슴 — 미는 것들
  '벤치프레스': '가슴', '푸시업': '가슴', '플라이': '가슴', '케이블': '가슴',
  '머신프레스': '가슴', '머신플라이': '가슴',
  // 등 — 당기는 것들. 데드리프트도 여기다 (다리로 들지만 등이 버틴다)
  '로우': '등', '풀업': '등', '풀다운': '등', '데드리프트': '등', '승모근': '등',
  // 어깨 — 머리 위로 밀거나 옆으로 드는 것들
  '프레스': '어깨', '레이즈': '어깨',
  // 팔
  '컬': '팔', '삼두': '팔', '딥스': '팔',
  // 하체
  '스쿼트': '하체', '런지': '하체', '하체머신': '하체', '둔근': '하체',
  '종아리': '하체', '햄스트링': '하체',
  // 코어
  '코어': '코어',
  // 숨차게 하는 것 · 온몸으로 하는 것
  '유산소': '전신 · 유산소', '전신': '전신 · 유산소',
};

/** 그 운동이 어느 부위인가. 갈래를 못 찾으면 `null` (검사가 잡는다) */
export function partOf(exercise) {
  return PART_OF_GROUP[exercise?.group] || null;
}

/** 그 부위의 운동들. 부위 이름이 아니면 빈 배열 */
export function byCategory(part) {
  const want = String(part || '').trim();
  if (!PARTS.includes(want)) return [];
  return EXERCISE_DICT.filter(e => partOf(e) === want);
}

/** 친 말이 부위 이름인가 (「등」 한 글자도 부위다) */
export function isPart(query) {
  return PARTS.includes(String(query || '').trim());
}

/** 영어 이름 → 한국어 이름. 외부 DB 결과에 우리 이름을 붙여줄 때 쓴다. */
export function koreanNameOf(enName) {
  const lower = norm(enName);
  if (!lower) return null;
  const m = EXERCISE_DICT.find(e => lower.includes(norm(e.en)) || norm(e.en).includes(lower));
  return m ? m.ko : null;
}

/** 한국어 검색어 → 외부 DB 에 물어볼 영어 말. 못 바꾸면 그대로 돌려준다. */
export function translateQuery(query) {
  const trimmed = String(query || '').trim();
  if (CATEGORY_DICT[trimmed]) return CATEGORY_DICT[trimmed];
  const q = norm(trimmed);
  const exact = EXERCISE_DICT.find(e => norm(e.ko) === q);
  if (exact) return exact.en;
  const partial = EXERCISE_DICT.find(e => norm(e.ko).includes(q) || q.includes(norm(e.ko)));
  if (partial) return partial.en;
  for (const [kr, en] of Object.entries(CATEGORY_DICT)) {
    if (trimmed.includes(kr)) return en;
  }
  return trimmed;
}
