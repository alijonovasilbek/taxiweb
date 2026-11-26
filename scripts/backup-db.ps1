# Ma'lumotlar bazasining zaxira nusxasi (pg_dump, siqilgan format) + eski nusxalarni tozalash.
#   powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1 [-Keep 14]
# Har kuni avtomatik: Task Scheduler → "powershell -ExecutionPolicy Bypass -File <yo'l>\scripts\backup-db.ps1"
# Tiklash: docker exec -i taxigo_postgres pg_restore -U taxigo -d taxigo_db --clean < backups\<fayl>.dump
param(
    [int]$Keep = 14,
    [string]$Container = "taxigo_postgres",
    [string]$User = "taxigo",
    [string]$Db = "taxigo_db"
)
# Native buyruqlar (docker, alembic) stderr ogohlantirishlari bilan to'xtamasin — natija $LASTEXITCODE bilan tekshiriladi
$ErrorActionPreference = "Continue"
$Dir = Join-Path (Split-Path -Parent $PSScriptRoot) "backups"
New-Item -ItemType Directory -Force $Dir | Out-Null

$file = Join-Path $Dir ("{0}_{1}.dump" -f $Db, (Get-Date -Format "yyyyMMdd_HHmmss"))
docker exec $Container pg_dump -U $User -d $Db -Fc -f /tmp/backup.dump
if ($LASTEXITCODE -ne 0) { throw "pg_dump muvaffaqiyatsiz" }
docker cp "${Container}:/tmp/backup.dump" $file
docker exec $Container rm -f /tmp/backup.dump | Out-Null
Write-Host ("Zaxira: {0} ({1:N1} MB)" -f $file, ((Get-Item $file).Length / 1MB))

Get-ChildItem $Dir -Filter "${Db}_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep |
    ForEach-Object { Remove-Item $_.FullName -Force; Write-Host "O'chirildi (eski): $($_.Name)" }
