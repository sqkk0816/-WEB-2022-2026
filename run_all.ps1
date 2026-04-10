# Auth: cookie.local.txt (one line) OR $env:LQ_COOKIE
# Usage: .\run_all.ps1              # default: first 3 problems
#        .\run_all.ps1 -Limit 5
#        .\run_all.ps1 -Limit 0     # full list (all problems in manifest)
#
# Runs: node automate_export.mjs (index -> export_final -> download.ps1 -> verify_report.txt)

param([int]$Limit = 3)
# 0 = full export (passed to automate as --limit=0)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$hasFile = Test-Path "cookie.local.txt"
$hasEnv = -not [string]::IsNullOrWhiteSpace($env:LQ_COOKIE)
if (-not $hasFile -and -not $hasEnv) {
  Write-Host "No Cookie: need cookie.local.txt OR LQ_COOKIE." -ForegroundColor Red
  exit 1
}

if ($Limit -le 0) {
  Write-Host "==> automate_export.mjs (full list)" -ForegroundColor Cyan
  node automate_export.mjs "--limit=0"
} else {
  Write-Host "==> automate_export.mjs --limit=$Limit" -ForegroundColor Cyan
  node automate_export.mjs "--limit=$Limit"
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. See: 题库成品\verify_report.txt and 题库成品\Web前端\" -ForegroundColor Green
