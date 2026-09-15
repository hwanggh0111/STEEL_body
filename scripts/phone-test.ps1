# 폰으로 앱을 테스트할 수 있는 상태로 만든다 (2026-09-15).
#
#   실행:  powershell -ExecutionPolicy Bypass -File scripts\phone-test.ps1
#   (Claude Code 프롬프트에서는  ! powershell -ExecutionPolicy Bypass -File scripts\phone-test.ps1)
#
# 하는 일:
#   1. 백엔드(4000) · 프론트 개발 서버(5173) 를 띄운다 (이미 떠 있으면 그대로 둔다)
#      - 프론트는 자동 로그인 끄고(VITE_DEV_AUTOLOGIN=0) 터널 호스트 허용(TUNNEL_HOSTS)
#   2. cloudflared 로 임시 https 터널을 연다 → 주소를 잡는다 (열 때마다 바뀐다)
#   3. 그 주소로 안드로이드 APK 를 새로 빌드한다
#   4. 주소와 APK 위치를 알려주고, 탐색기에 APK 를 띄운다
#
# 폰: 같은 결과의 APK 를 메일/드라이브로 받아 설치. 터널이라 와이파이·데이터 둘 다 열린다.
# **테스트가 끝나면 이 스크립트가 띄운 창들(백엔드·프론트·cloudflared)을 닫으면 다 내려간다.**

$ErrorActionPreference = 'Stop'
$root     = Split-Path $PSScriptRoot -Parent
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$androidD = Join-Path $frontend 'android'

# 안드로이드 빌드 도구 (Android Studio 가 들고 있는 것을 쓴다)
$env:JAVA_HOME    = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'

# cloudflared 찾기: PATH → winget 설치 위치
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) {
  $cf = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages') -Recurse -Filter 'cloudflared.exe' -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $cf) { Write-Error 'cloudflared 를 못 찾았어요. winget install Cloudflare.cloudflared 로 설치하세요.'; exit 1 }

function Test-Port($port) {
  [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}
function Start-Server($title, $dir, $cmd) {
  # 각자 자기 창(최소화)에서 돈다 — 창을 닫으면 그 서버가 내려간다
  Start-Process -WindowStyle Minimized -WorkingDirectory $dir cmd.exe -ArgumentList '/c', "title $title && $cmd"
}

Write-Host '── 폰 테스트 준비 ──' -ForegroundColor Cyan

# 1) 서버
if (Test-Port 4000) {
  Write-Host '백엔드(4000) 이미 떠 있음'
} else {
  Write-Host '백엔드(4000) 시작...'
  Start-Server 'BLACKIRON-backend' $backend 'npm start'
}

if (Test-Port 5173) {
  Write-Host '프론트 개발 서버(5173) 이미 떠 있음 (자동로그인/터널호스트 설정은 처음 띄운 값을 따름)'
} else {
  Write-Host '프론트 개발 서버(5173) 시작... (자동 로그인 끔 · 터널 허용)'
  Start-Server 'BLACKIRON-frontend' $frontend 'set VITE_DEV_AUTOLOGIN=0&& set TUNNEL_HOSTS=.trycloudflare.com&& npm run dev'
}

Write-Host '두 서버가 응답할 때까지 기다립니다...'
$ok = $false
for ($i = 0; $i -lt 90; $i++) {
  if ((Test-Port 4000) -and (Test-Port 5173)) { $ok = $true; break }
  Start-Sleep -Milliseconds 700
}
if (-not $ok) { Write-Error '서버가 안 떴어요. BLACKIRON-backend / BLACKIRON-frontend 창의 메시지를 확인하세요.'; exit 1 }

# 2) 터널
Write-Host '터널 여는 중... (옛 터널은 닫습니다)'
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$log = Join-Path $env:TEMP 'blackiron-tunnel.log'
Remove-Item $log, "$log.err" -ErrorAction SilentlyContinue
Start-Process -WindowStyle Minimized $cf `
  -ArgumentList 'tunnel', '--no-autoupdate', '--url', 'http://localhost:5173' `
  -RedirectStandardOutput $log -RedirectStandardError "$log.err"

$url = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  $txt = (Get-Content $log, "$log.err" -ErrorAction SilentlyContinue) -join "`n"
  $m = [regex]::Match($txt, 'https://[a-z0-9-]+\.trycloudflare\.com')
  if ($m.Success) { $url = $m.Value; break }
}
if (-not $url) { Write-Error '터널 주소를 못 잡았어요. 잠시 뒤 다시 실행해 보세요.'; exit 1 }
Write-Host "터널 주소: $url" -ForegroundColor Green

# 3) APK 빌드 (그 주소를 보도록)
#
# **빌드 도구는 경고를 stderr 로 낸다** (esbuild 등). PowerShell 5.1 은 native 명령의
# stderr 를 에러로 삼켜 멀쩡한 빌드를 실패로 만든다. 그래서 cmd 안에서 출력을 삼키고
# (`> nul 2>&1`), 진짜 성공·실패는 **종료 코드**로만 본다.
Write-Host 'APK 빌드 중... (1~2분)'
$env:CAP_SERVER_URL = $url
$gradleLog = Join-Path $env:TEMP 'blackiron-gradle.log'

Push-Location $frontend
cmd /c 'npm run build > nul 2>&1'
$buildOk = ($LASTEXITCODE -eq 0)
if ($buildOk) { cmd /c 'npx cap sync android > nul 2>&1'; $buildOk = ($LASTEXITCODE -eq 0) }
Pop-Location

if ($buildOk) {
  Push-Location $androidD
  cmd /c ".\gradlew.bat assembleDebug --console=plain > `"$gradleLog`" 2>&1"
  $buildOk = ($LASTEXITCODE -eq 0)
  Pop-Location
  (Get-Content $gradleLog -ErrorAction SilentlyContinue | Select-String 'BUILD SUCCESSFUL|BUILD FAILED|error:') | ForEach-Object { $_.Line }
}

$apk = Join-Path $androidD 'app\build\outputs\apk\debug\app-debug.apk'
if (-not $buildOk -or -not (Test-Path $apk)) {
  Write-Error "APK 빌드 실패. 자세한 것은 $gradleLog (또는 위 프론트 빌드) 를 보세요."; exit 1
}

Write-Host ''
Write-Host '════════════ 준비 끝 ════════════' -ForegroundColor Cyan
Write-Host "터널 주소 : $url"
Write-Host "APK 파일  : $apk"
$mb = [math]::Round((Get-Item $apk).Length / 1MB, 1)
Write-Host "APK 크기  : $mb MB"
Write-Host ''
Write-Host '이 APK 를 폰으로 옮겨 설치하세요 (메일 첨부가 막히면 구글 드라이브).'
Write-Host 'PC 를 켜두고, 이 스크립트가 띄운 창 세 개(backend·frontend·cloudflared)를 열어두세요.'
Write-Host '끝내려면 그 창들을 닫으면 다 내려갑니다.'
explorer.exe "/select,$apk"
