#!/bin/bash
API="http://localhost:4000/api"
PASS=0
FAIL=0
TOKEN=""

pass() { PASS=$((PASS+1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL+1)); echo "  [FAIL] $1 -- $2"; }

echo "=== 1. 인증 테스트 ==="

# 회원가입
RES=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" -H "Content-Type: application/json" -d '{"email":"test_api@test.com","password":"Test1234","nickname":"API테스터","username":"apitest1"}')
CODE=$(echo "$RES" | tail -1)
if [ "$CODE" = "201" ] || [ "$CODE" = "409" ]; then pass "회원가입 ($CODE)"; else fail "회원가입" "$CODE"; fi

# 중복가입 차단
RES=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" -H "Content-Type: application/json" -d '{"email":"test_api@test.com","password":"Test1234","nickname":"중복","username":"apitest1"}')
CODE=$(echo "$RES" | tail -1)
if [ "$CODE" = "409" ]; then pass "중복가입 차단"; else fail "중복가입" "$CODE"; fi

# 필수항목 누락
RES=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" -H "Content-Type: application/json" -d '{"email":"","password":"","nickname":"","username":""}')
CODE=$(echo "$RES" | tail -1)
if [ "$CODE" = "400" ]; then pass "필수항목 누락 차단"; else fail "필수항목" "$CODE"; fi

# 로그인
RES=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"test_api@test.com","password":"Test1234"}')
CODE=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | head -1)
TOKEN=$(echo "$BODY" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token" 2>/dev/null)
if [ "$CODE" = "200" ] && [ -n "$TOKEN" ]; then pass "로그인 + 토큰"; else fail "로그인" "$CODE"; fi

# 잘못된 비밀번호
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"test_api@test.com","password":"wrong"}')
if [ "$CODE" = "401" ]; then pass "잘못된 비밀번호 차단"; else fail "비밀번호 차단" "$CODE"; fi

# 아이디 중복확인
BODY=$(curl -s -X POST "$API/auth/check-username" -H "Content-Type: application/json" -d '{"username":"apitest1"}')
AVAIL=$(echo "$BODY" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).available" 2>/dev/null)
if [ "$AVAIL" = "false" ]; then pass "아이디 중복 감지"; else fail "아이디 중복" "$AVAIL"; fi

# 내 정보
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN")
if [ "$CODE" = "200" ]; then pass "내 정보 조회"; else fail "내 정보" "$CODE"; fi

# 인증 없이 접근
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/workouts")
if [ "$CODE" = "401" ]; then pass "인증 없이 접근 차단"; else fail "무인증 접근" "$CODE"; fi

echo ""
echo "=== 2. 운동 기록 테스트 ==="

# 운동 추가
RES=$(curl -s -w "\n%{http_code}" -X POST "$API/workouts" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"date":"2026-04-13","exercise":"벤치프레스","sets":3,"reps":10,"weight":"80"}')
CODE=$(echo "$RES" | tail -1)
WID=$(echo "$RES" | head -1 | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id" 2>/dev/null)
if [ "$CODE" = "201" ]; then pass "운동 추가 (id=$WID)"; else fail "운동 추가" "$CODE"; fi

# 음수 세트
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/workouts" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"date":"2026-04-13","exercise":"스쿼트","sets":-1,"reps":10}')
if [ "$CODE" = "400" ]; then pass "음수 세트 차단"; else fail "음수 세트" "$CODE"; fi

# 0 횟수
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/workouts" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"date":"2026-04-13","exercise":"스쿼트","sets":3,"reps":0}')
if [ "$CODE" = "400" ]; then pass "0 횟수 차단"; else fail "0 횟수" "$CODE"; fi

# 운동 목록
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/workouts" -H "Authorization: Bearer $TOKEN")
if [ "$CODE" = "200" ]; then pass "운동 목록 조회"; else fail "운동 조회" "$CODE"; fi

# 운동 삭제
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/workouts/$WID" -H "Authorization: Bearer $TOKEN")
if [ "$CODE" = "200" ]; then pass "운동 삭제"; else fail "운동 삭제" "$CODE"; fi

echo ""
echo "=== 3. 인바디 테스트 ==="

# 인바디 추가
RES=$(curl -s -w "\n%{http_code}" -X POST "$API/inbody" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"date":"2026-04-13","weight":75,"height":175,"fat_pct":15,"muscle_kg":35}')
CODE=$(echo "$RES" | tail -1)
IID=$(echo "$RES" | head -1 | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id" 2>/dev/null)
if [ "$CODE" = "201" ]; then pass "인바디 추가 (id=$IID)"; else fail "인바디 추가" "$CODE"; fi

# 체중 누락
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/inbody" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"date":"2026-04-13"}')
if [ "$CODE" = "400" ]; then pass "체중 누락 차단"; else fail "체중 누락" "$CODE"; fi

# 비정상 체중
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/inbody" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"weight":999}')
if [ "$CODE" = "400" ]; then pass "비정상 체중 차단"; else fail "비정상 체중" "$CODE"; fi

# 인바디 삭제
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/inbody/$IID" -H "Authorization: Bearer $TOKEN")
if [ "$CODE" = "200" ]; then pass "인바디 삭제"; else fail "인바디 삭제" "$CODE"; fi

echo ""
echo "=== 4. 측정 시스템 테스트 ==="

# 전신사이즈
RES=$(curl -s -w "\n%{http_code}" -X POST "$API/measures" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"type":"bodySize","date":"2026-04-13","data":{"chest":"95","waist":"78"}}')
CODE=$(echo "$RES" | tail -1)
MID=$(echo "$RES" | head -1 | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id" 2>/dev/null)
if [ "$CODE" = "201" ]; then pass "전신사이즈 저장 (id=$MID)"; else fail "전신사이즈" "$CODE"; fi

# 잘못된 타입
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/measures" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"type":"invalid","date":"2026-04-13","data":{"x":"y"}}')
if [ "$CODE" = "400" ]; then pass "잘못된 타입 차단"; else fail "잘못된 타입" "$CODE"; fi

# 측정 조회
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/measures" -H "Authorization: Bearer $TOKEN")
if [ "$CODE" = "200" ]; then pass "측정 조회"; else fail "측정 조회" "$CODE"; fi

# 측정 삭제
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/measures/$MID" -H "Authorization: Bearer $TOKEN")
if [ "$CODE" = "200" ]; then pass "측정 삭제"; else fail "측정 삭제" "$CODE"; fi

echo ""
echo "=== 5. 루틴 테스트 ==="

# 추천 루틴
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/routines/%EB%A8%B8%EC%8B%A0" -H "Authorization: Bearer $TOKEN")
if [ "$CODE" = "200" ]; then pass "추천 루틴 조회"; else fail "추천 루틴" "$CODE"; fi

# 나만의 루틴 저장
RES=$(curl -s -w "\n%{http_code}" -X POST "$API/my-routines" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"name":"월요일","exercises":[{"name":"벤치","sets":"4","reps":"10"}]}')
CODE=$(echo "$RES" | tail -1)
RID=$(echo "$RES" | head -1 | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).id" 2>/dev/null)
if [ "$CODE" = "201" ]; then pass "나만의 루틴 저장 (id=$RID)"; else fail "루틴 저장" "$CODE"; fi

# 빈 운동
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/my-routines" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"name":"빈","exercises":[]}')
if [ "$CODE" = "400" ]; then pass "빈 운동 차단"; else fail "빈 운동" "$CODE"; fi

# 루틴 삭제
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/my-routines/$RID" -H "Authorization: Bearer $TOKEN")
if [ "$CODE" = "200" ]; then pass "루틴 삭제"; else fail "루틴 삭제" "$CODE"; fi

echo ""
echo "=== 6. 공지사항 테스트 ==="

# 공지 조회 (인증 불필요)
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/notices")
if [ "$CODE" = "200" ]; then pass "공지 조회 (공개)"; else fail "공지 조회" "$CODE"; fi

# 일반 유저 작성 차단
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/notices" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"date":"2026-04-13","title":"테스트","type":"공지","content":"내용"}')
if [ "$CODE" = "403" ]; then pass "일반 유저 공지 작성 차단"; else fail "공지 권한" "$CODE"; fi

echo ""
echo "=== 7. 닉네임 변경 테스트 ==="

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$API/auth/nickname" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"nickname":"새닉네임"}')
if [ "$CODE" = "200" ]; then pass "닉네임 변경"; else fail "닉네임 변경" "$CODE"; fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$API/auth/nickname" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"nickname":""}')
if [ "$CODE" = "400" ]; then pass "빈 닉네임 차단"; else fail "빈 닉네임" "$CODE"; fi

echo ""
echo "=== 8. 보안 테스트 ==="

# 잘못된 토큰
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/workouts" -H "Authorization: Bearer invalidtoken")
if [ "$CODE" = "401" ]; then pass "잘못된 토큰 차단"; else fail "잘못된 토큰" "$CODE"; fi

# 없는 기록 삭제
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/workouts/99999" -H "Authorization: Bearer $TOKEN")
if [ "$CODE" = "404" ]; then pass "없는 기록 삭제 404"; else fail "없는 기록" "$CODE"; fi

# gzip
HEADERS=$(curl -s -D - -H "Accept-Encoding: gzip" "$API/notices" -o /dev/null 2>&1)
if echo "$HEADERS" | grep -qi "content-encoding.*gzip"; then pass "gzip 압축 동작"; else fail "gzip" "미동작"; fi

echo ""
echo "=== 9. 프론트엔드 테스트 ==="

CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173")
if [ "$CODE" = "200" ]; then pass "프론트엔드 로드"; else fail "프론트엔드" "$CODE"; fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/api/health")
if [ "$CODE" = "200" ]; then pass "Vite 프록시"; else fail "프록시" "$CODE"; fi

echo ""
echo "========================================"
echo "  결과: PASS=$PASS / FAIL=$FAIL"
echo "  총 테스트: $((PASS+FAIL))건"
echo "========================================"
