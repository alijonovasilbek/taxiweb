# Chortoq Services — lokal jarayonlarni to'xtatish (backend qo'riqchisi, uvicorn, ngrok). Docker konteynerlari qoladi.
#   powershell -ExecutionPolicy Bypass -File scripts\stop-local.ps1 [-Docker]
param([switch]$Docker)

# Avval qo'riqchi (aks holda u backend'ni qayta yoqib yuboradi)
$pidFile = Join-Path (Split-Path -Parent $PSScriptRoot) "backend\logs\watchdog.pid"
if (Test-Path $pidFile) {
    $wd = Get-Content $pidFile | Select-Object -First 1
    if ($wd) { Stop-Process -Id ([int]$wd) -Force -Confirm:$false -ErrorAction SilentlyContinue }
    Remove-Item $pidFile -Force
}
Get-Process uvicorn, ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -Confirm:$false
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force -Confirm:$false }

if ($Docker) { docker stop chortoq_gateway taxigo_redis taxigo_postgres | Out-Null }
Write-Host "To'xtatildi."
