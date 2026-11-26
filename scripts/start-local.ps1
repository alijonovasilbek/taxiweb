# Chortoq Services — lokal sinov muhitini bitta buyruq bilan ishga tushirish (Windows PowerShell 5.1)
#
#   powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1            # hammasi
#   powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1 -NoNgrok   # tunnelsiz
#   powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1 -Build     # avval frontend build
#
# Nima qiladi:
#   1) Docker Desktop'ni yoqadi va Postgres, Redis, nginx gateway konteynerlarini ishga tushiradi
#   2) Migratsiyalarni qo'llaydi (alembic upgrade head)
#   3) Backend'ni (uvicorn :3000) qo'riqchi tsikl bilan ishga tushiradi — o'chib qolsa 3 soniyada qayta yonadi
#   4) ngrok tunnelini ochadi (8080 → HTTPS)
param(
    [switch]$NoNgrok,
    [switch]$Build,
    [string]$Ngrok = "D:\ngrok-v3-stable-windows-amd64\ngrok.exe",
    [string]$DockerDesktop = "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
)
# Native buyruqlar (docker, alembic) stderr ogohlantirishlari bilan to'xtamasin — natija $LASTEXITCODE bilan tekshiriladi
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Logs = Join-Path $Backend "logs"
New-Item -ItemType Directory -Force $Logs | Out-Null

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# 1. Docker
Write-Step "Docker"
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    if (-not (Test-Path $DockerDesktop)) { throw "Docker Desktop topilmadi: $DockerDesktop" }
    Start-Process $DockerDesktop
    for ($i = 0; $i -lt 60; $i++) { Start-Sleep 3; docker info 2>&1 | Out-Null; if ($LASTEXITCODE -eq 0) { break } }
    if ($LASTEXITCODE -ne 0) { throw "Docker 3 daqiqada ishga tushmadi" }
}
docker start taxigo_postgres taxigo_redis chortoq_gateway | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Konteynerlarni ishga tushirib bo'lmadi (docker ps -a ni tekshiring)" }

# 2. Frontend build (ixtiyoriy)
if ($Build) {
    foreach ($app in "passenger-app", "admin-panel") {
        Write-Step "Build: $app"
        Push-Location (Join-Path $Root $app); npm run build; Pop-Location
    }
}

# 3. Migratsiyalar
Write-Step "Migratsiyalar"
Push-Location $Backend
& .\.venv\Scripts\alembic.exe upgrade head
Pop-Location

# 4. Backend — qo'riqchi tsikl (alohida oynasiz jarayon)
Write-Step "Backend :3000 (avtomatik qayta ishga tushish bilan)"
$watchdog = @"
Set-Content '$Logs\watchdog.pid' `$PID
`$env:PYTHONUNBUFFERED = '1'; `$env:PYTHONIOENCODING = 'utf-8'
Set-Location '$Backend'
while (`$true) {
    & .\.venv\Scripts\uvicorn.exe main:socket_app --port 3000 *>> '$Logs\backend.log'
    Add-Content '$Logs\backend.log' "`$(Get-Date -Format s) backend to'xtadi (kod `$LASTEXITCODE) — 3 soniyada qayta ishga tushiriladi"
    Start-Sleep 3
}
"@
# Ko'p qatorli skript qo'shtirnoqlari buzilmasligi uchun -EncodedCommand (UTF-16LE base64)
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($watchdog))
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile", "-EncodedCommand", $encoded
Start-Sleep 6
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "    Backend ishlayapti" -ForegroundColor Green
} else { Write-Host "    Backend hali javob bermayapti — $Logs\backend.log" -ForegroundColor Yellow }

# 5. ngrok
if (-not $NoNgrok) {
    if (Test-Path $Ngrok) {
        Write-Step "ngrok (8080 → HTTPS)"
        Start-Process $Ngrok -WindowStyle Hidden -ArgumentList "http", "8080", "--log", "$Logs\ngrok.log"
        Start-Sleep 4
        try {
            $url = (Invoke-RestMethod http://127.0.0.1:4040/api/tunnels).tunnels[0].public_url
            Write-Host "    Ochiq manzil: $url" -ForegroundColor Green
        } catch { Write-Host "    ngrok manzilini olib bo'lmadi — $Logs\ngrok.log" -ForegroundColor Yellow }
    } else { Write-Host "    ngrok topilmadi: $Ngrok" -ForegroundColor Yellow }
}

Write-Step "Tayyor. Loglar: $Logs\backend.log"
Write-Host "    To'xtatish: scripts\stop-local.ps1"
