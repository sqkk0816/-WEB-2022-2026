/**
 * 根据题目 document 里 ```bash 中的 wget 行，生成 download.ps1：
 * - 下载 zip 到临时目录并解压到本目录下的 CODE\
 * - 若 zip 内仅一层子目录，则把内容提到 CODE 根下
 */
export function buildDownloadPs1FromDocument(document, zipFileNameFallback = "starter.zip") {
  const blocks = [...document.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
  let wgetLine = "";
  for (const bash of blocks) {
    const line = bash
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.startsWith("wget "));
    if (line) {
      wgetLine = line;
      break;
    }
  }
  if (!wgetLine) {
    return (
      `# No wget line found in problem document.\r\n` +
      `# Download starter files from the Lanqiao web IDE if needed.\r\n` +
      `Write-Host "No automatic download URL in 题目描述.md"\r\n`
    );
  }

  const urlMatch = wgetLine.match(/wget\s+(https?:\/\/[^\s&]+)/i);
  if (!urlMatch) {
    return `# Could not parse zip URL from wget line.\r\nWrite-Host "Parse error"\r\n`;
  }
  const zipUrl = urlMatch[1];
  const zipLeaf = zipUrl.split("/").pop() || zipFileNameFallback;
  const safeZipName = zipLeaf.replace(/[^a-zA-Z0-9._-]/g, "_");

  const lines = [
    "# Auto-generated: download starter zip into .\\CODE",
    "# Run: powershell -ExecutionPolicy Bypass -File .\\download.ps1",
    '$ErrorActionPreference = "Stop"',
    '$Root = $PSScriptRoot',
    '$CodeDir = Join-Path $Root "CODE"',
    '$zipUrl = "' + zipUrl + '"',
    '$zipFile = Join-Path $env:TEMP ("lanqiao_dl_" + [Guid]::NewGuid().ToString() + ".zip")',
    'Write-Host "Downloading:" $zipUrl',
    'Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile',
    'if (Test-Path $CodeDir) { Remove-Item $CodeDir -Recurse -Force }',
    'New-Item -ItemType Directory -Path $CodeDir -Force | Out-Null',
    '$tmpExtract = Join-Path $env:TEMP ("lanqiao_unpack_" + [Guid]::NewGuid().ToString())',
    'New-Item -ItemType Directory -Path $tmpExtract -Force | Out-Null',
    'Expand-Archive -Path $zipFile -DestinationPath $tmpExtract -Force',
    'Remove-Item $zipFile -Force -ErrorAction SilentlyContinue',
    '$top = Get-ChildItem -LiteralPath $tmpExtract',
    'if ($top.Count -eq 1 -and $top[0].PSIsContainer) {',
    '  Copy-Item -Path (Join-Path $top[0].FullName "*") -Destination $CodeDir -Recurse -Force',
    '} else {',
    '  Copy-Item -Path (Join-Path $tmpExtract "*") -Destination $CodeDir -Recurse -Force',
    '}',
    'Remove-Item $tmpExtract -Recurse -Force',
    'Write-Host "Done. Starter code is in:" $CodeDir',
  ];
  return lines.join("\r\n") + "\r\n";
}
