# Auto-generated: download starter zip into .\CODE
# Run: powershell -ExecutionPolicy Bypass -File .\download.ps1
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$CodeDir = Join-Path $Root "CODE"
$zipUrl = "https://labfile.oss.aliyuncs.com/courses/18164/wish.zip"
$zipFile = Join-Path $env:TEMP ("lanqiao_dl_" + [Guid]::NewGuid().ToString() + ".zip")
Write-Host "Downloading:" $zipUrl
Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile
if (Test-Path $CodeDir) { Remove-Item $CodeDir -Recurse -Force }
New-Item -ItemType Directory -Path $CodeDir -Force | Out-Null
$tmpExtract = Join-Path $env:TEMP ("lanqiao_unpack_" + [Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tmpExtract -Force | Out-Null
Expand-Archive -Path $zipFile -DestinationPath $tmpExtract -Force
Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
$top = Get-ChildItem -LiteralPath $tmpExtract
if ($top.Count -eq 1 -and $top[0].PSIsContainer) {
  Copy-Item -Path (Join-Path $top[0].FullName "*") -Destination $CodeDir -Recurse -Force
} else {
  Copy-Item -Path (Join-Path $tmpExtract "*") -Destination $CodeDir -Recurse -Force
}
Remove-Item $tmpExtract -Recurse -Force
Write-Host "Done. Starter code is in:" $CodeDir
