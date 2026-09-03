// 메모에 적은 것을 루틴으로 제대로 읽는가.
//
//   npm run note
//
// 루틴 메모장의 알맹이는 **사람이 적는 대로 읽는 것**이다. 다시 칸에 옮겨 적게 하면
// 메모장을 만든 뜻이 없다. 사람마다 적는 법이 다르므로 여러 모양을 받는데,
// 그 「여러 모양」이 서로 걸려드는 자리라서 글자로 본다.
//
// 특히 조심할 것 둘:
//   1. `5세트 10회` 를 `5x10` 규칙보다 먼저 봐야 한다. 순서가 바뀌면 엉뚱한 숫자를 문다
//   2. 무게는 이름에서 떼어낸다. 「벤치프레스 60kg」이 운동 이름이 되면
//      기록 화면의 자동완성과 최고 기록이 무게마다 다른 운동으로 갈라진다
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

esbuild.buildSync({
  entryPoints: ['src/data/routineNote.js'], bundle: true, format: 'cjs',
  outfile: '.note.cjs', platform: 'node', logLevel: 'silent',
});
const N = require(path.resolve('.note.cjs'));
fs.unlinkSync('.note.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' -> ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const line = (s) => N.parseLine(s);

console.log('── 한 줄을 어떻게 읽는가 ──');
ok('벤치프레스 5x10', line('벤치프레스 5x10'), { name: '벤치프레스', sets: '5', reps: '10' });
ok('대문자 X 도 같다', line('벤치프레스 5X10'), { name: '벤치프레스', sets: '5', reps: '10' });
ok('별표도 같다', line('벤치프레스 5*10'), { name: '벤치프레스', sets: '5', reps: '10' });
ok('곱셈 기호도 같다', line('벤치프레스 5×10'), { name: '벤치프레스', sets: '5', reps: '10' });
ok('5세트 10회', line('벤치프레스 5세트 10회'), { name: '벤치프레스', sets: '5', reps: '10' });
ok('붙여 써도 읽는다', line('벤치프레스 5세트10회'), { name: '벤치프레스', sets: '5', reps: '10' });
ok('「씩」이 끼어도 읽는다', line('벤치프레스 5세트씩 10회'), { name: '벤치프레스', sets: '5', reps: '10' });
ok('순서가 반대여도 읽는다', line('벤치프레스 10회 5세트'), { name: '벤치프레스', sets: '5', reps: '10' });
ok('세트만 적었으면 세트만', line('플랭크 3세트'), { name: '플랭크', sets: '3', reps: '' });
ok('횟수만 적었으면 횟수만', line('버피 20회'), { name: '버피', sets: '', reps: '20' });
ok('아무것도 없으면 이름만', line('딥스'), { name: '딥스', sets: '', reps: '' });

console.log('');
console.log('── 적을 때 붙는 것들 ──');
ok('앞의 - 를 뗀다', line('- 스쿼트 5x5'), { name: '스쿼트', sets: '5', reps: '5' });
ok('가운뎃점도 뗀다', line('· 스쿼트 5x5'), { name: '스쿼트', sets: '5', reps: '5' });
ok('번호도 뗀다', line('2. 인클라인 덤벨 3x12'), { name: '인클라인 덤벨', sets: '3', reps: '12' });
ok('괄호 번호도 뗀다', line('3) 랫풀다운 4x12'), { name: '랫풀다운', sets: '4', reps: '12' });
ok('무게는 이름에서 뗀다', line('케이블 푸시다운 60kg 4x15'), { name: '케이블 푸시다운', sets: '4', reps: '15' });
ok('한글 무게도 뗀다', line('레그프레스 100킬로 5x8'), { name: '레그프레스', sets: '5', reps: '8' });
ok('소수점 무게도 뗀다', line('덤벨컬 12.5kg 3x12'), { name: '덤벨컬', sets: '3', reps: '12' });
ok('쉼표는 공백으로', line('벤치프레스, 5x10'), { name: '벤치프레스', sets: '5', reps: '10' });
ok('제목 줄은 운동이 아니다', line('월요일 가슴:'), null);
ok('빈 줄은 운동이 아니다', line('   '), null);
ok('숫자만 적힌 줄은 버린다', line('5x10'), null);
ok('이상한 값이 와도 안 터진다', line(null), null);
ok('이름은 60자에서 끊는다', line('가'.repeat(80)).name.length, 60);

console.log('');
console.log('── 메모 한 장을 루틴으로 ──');
const memo = [
  '월요일 가슴 · 삼두',
  '- 벤치프레스 60kg 5x5',
  '2. 인클라인 덤벨 3세트 12회',
  '',
  '케이블 푸시다운 4x15',
  '딥스',
].join('\n');
const r = N.noteToRoutine(memo);
ok('첫 줄이 루틴 이름이 된다 (가운뎃점은 사람이 적은 그대로 둔다)', r.name, '월요일 가슴 · 삼두');
ok('운동 넷을 읽는다', r.exercises.length, 4);
ok('  첫 운동', r.exercises[0], { name: '벤치프레스', sets: '5', reps: '5' });
ok('  둘째 운동', r.exercises[1], { name: '인클라인 덤벨', sets: '3', reps: '12' });
ok('  세트를 안 적은 것도 넣는다', r.exercises[3], { name: '딥스', sets: '', reps: '' });
ok('빈 줄은 안 센다', N.countExercises(memo), 4);

const noTitle = ['벤치프레스 5x5', '스쿼트 5x5'].join('\n');
ok('첫 줄이 운동이면 이름을 지어내지 않는다', N.noteToRoutine(noTitle).name, '');
ok('  그 줄도 운동으로 센다', N.noteToRoutine(noTitle).exercises.length, 2);

const oneLine = N.noteToRoutine('가슴');
ok('한 줄뿐이면 그것은 운동이다 (이름이 아니다)', oneLine.exercises.length, 1);

ok('빈 메모는 빈 루틴', N.noteToRoutine(''), { name: '', exercises: [] });
ok('이상한 값이 와도 안 터진다', N.noteToRoutine(null), { name: '', exercises: [] });
ok('운동은 정해진 개수까지만 (서버가 50개까지 받는다)',
  N.noteToRoutine(Array.from({ length: 80 }, (_, i) => `운동${i} 3x10`).join('\n')).exercises.length, 50);

console.log('');
console.log('── 목록에 보일 이름 ──');
ok('첫 줄을 쓴다', N.noteTitle(memo), '월요일 가슴 · 삼두');
ok('글머리표는 뗀다', N.noteTitle('- 벤치프레스 5x5'), '벤치프레스 5x5');
ok('빈 메모', N.noteTitle('   '), '(빈 메모)');
ok('긴 줄은 끊는다', N.noteTitle('가'.repeat(60)).length, 41);

console.log('');
console.log(bad ? bad + '건 실패' : '전부 통과');
process.exit(bad ? 1 : 0);
