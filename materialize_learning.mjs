/**
 * （已由 export_final + automate_export 替代成品流程；保留脚本供历史缓存。）
 * 从已拉取的 detail.json 导出「学习页」同款内容：
 *   - 题目描述.md  ← challenge.document（含背景介绍、准备步骤、考试需求等）
 *   - download.ps1 ← 将 bash 中的 wget 命令转为 PowerShell（Invoke-WebRequest + Expand-Archive）
 *
 * 说明：learning 页面正文一般即服务端下发的 document，无需再爬 HTML。
 *
 * 用法：
 *   node materialize_learning.mjs                    # 扫描 题目源码/Web前端 下所有 detail.json
 *   node materialize_learning.mjs --id=1453          # 仅处理 id（需已有 detail.json 缓存）
 *   node materialize_learning.mjs --fetch=1453     # 先请求 API 再导出（需 LQ_COOKIE 或 cookie.local.txt）
 */
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DETAIL_CACHE = path.join(ROOT, "题目详情缓存");
const SRC_WEB = path.join(ROOT, "题目源码", "Web前端");

function loadCookie() {
  const env = process.env.LQ_COOKIE?.trim();
  if (env) return env;
  const p = path.join(ROOT, "cookie.local.txt");
  if (fs.existsSync(p)) {
    const line = fs
      .readFileSync(p, "utf8")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s && !s.startsWith("#"));
    if (line) return line;
  }
  return "";
}

function fetchHttps(url, cookie) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/json",
            Cookie: cookie,
            Referer: "https://www.lanqiao.cn/problems/",
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            try {
              resolve(JSON.parse(text));
            } catch {
              resolve({ _raw: text });
            }
          });
        }
      )
      .on("error", reject);
  });
}

/** 在 bash 代码块中查找 wget 行并生成 PowerShell 脚本 */
function bashWgetToPowerShell(bash) {
  const lines = bash
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const wgetLine = lines.find((l) => l.startsWith("wget "));
  if (!wgetLine) return null;

  const urlMatch = wgetLine.match(/wget\s+(https?:\/\/[^\s&]+)/i);
  if (!urlMatch) return null;
  const zipUrl = urlMatch[1];

  const zipNameGuess = zipUrl.split("/").pop() || "download.zip";
  const safeName = zipNameGuess.replace(/[^a-zA-Z0-9._-]/g, "_");

  const ps = [];
  ps.push("# 由 materialize_learning.mjs 从题目 wget 自动生成");
  ps.push("$ErrorActionPreference = 'Stop'");
  ps.push(`$zipUrl = "${zipUrl}"`);
  ps.push(`$zipFile = Join-Path $PSScriptRoot "${safeName}"`);
  ps.push(`Write-Host "Downloading" $zipUrl`);
  ps.push(`Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile`);
  ps.push(`Expand-Archive -Path $zipFile -DestinationPath $PSScriptRoot -Force`);

  // 常见后缀：&& rm exam01.zip
  if (/&&\s*rm\s+/.test(wgetLine) || /&&\s*rm\s+exam/.test(wgetLine)) {
    ps.push(`Remove-Item -LiteralPath $zipFile -Force -ErrorAction SilentlyContinue`);
  }

  // mv folder/* ./ && rm -rf folder*
  const mvMatch = wgetLine.match(/wget[^&]+&&\s*unzip\s+([^\s&]+)\s*&&\s*mv\s+([^/]+)\/\*\s+\.\/\s*&&\s*rm\s+-rf\s+(\S+)/);
  if (mvMatch) {
    const folder = mvMatch[2].replace(/\*$/, "");
    ps.push(`# 解压后若存在子目录 ${folder}，请取消下面注释并核对路径`);
    ps.push(`# Move-Item -Path (Join-Path $PSScriptRoot '${folder}')\\* -Destination $PSScriptRoot -Force`);
    ps.push(`# Remove-Item -Recurse -Force (Join-Path $PSScriptRoot '${folder}') -ErrorAction SilentlyContinue`);
  }

  ps.push(`Write-Host "Done. Files are in:" $PSScriptRoot`);
  return ps.join("\n");
}

function walkDetailJson(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "_raw") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkDetailJson(p, acc);
    else if (name === "detail.json") acc.push(p);
  }
  return acc;
}

function findDetailJsonForId(id) {
  const cached = path.join(DETAIL_CACHE, `${id}.json`);
  if (fs.existsSync(cached)) return cached;
  if (fs.existsSync(SRC_WEB)) {
    for (const topic of fs.readdirSync(SRC_WEB)) {
      const candidate = path.join(SRC_WEB, topic, String(id), "detail.json");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function getMaterialDir(detailPath, id) {
  if (path.basename(detailPath) === "detail.json") {
    return path.dirname(detailPath);
  }
  const d = path.dirname(detailPath);
  const sub = path.join(d, String(id));
  fs.mkdirSync(sub, { recursive: true });
  return sub;
}

function processDetail(detailPath, detail) {
  const id = detail.id;
  const name = detail.name || "题目";
  const doc = detail.challenge?.document;
  const dir = getMaterialDir(detailPath, id);

  if (!doc) {
    console.warn(`[${id}] ${name} 无 challenge.document（OJ 题或接口未展开），跳过导出`);
    return false;
  }

  const mdPath = path.join(dir, "题目描述.md");
  fs.writeFileSync(mdPath, doc, "utf8");
  console.log(`  已写入: ${mdPath}`);

  const bashBlocks = [...doc.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
  let psCombined = [];
  for (const bash of bashBlocks) {
    const ps = bashWgetToPowerShell(bash);
    if (ps) psCombined.push(ps);
  }
  if (psCombined.length) {
    const psPath = path.join(dir, "download.ps1");
    fs.writeFileSync(
      psPath,
      psCombined.join("\n\n# --- next block ---\n\n"),
      "utf8"
    );
    console.log(`  已写入: ${psPath}`);
  } else {
    console.log(`  未检测到 wget 行，未生成 download.ps1`);
  }
  return true;
}

async function main() {
  const argv = process.argv.slice(2);
  const fetchId = argv.find((a) => a.startsWith("--fetch="))?.slice(8);
  const onlyId = argv.find((a) => a.startsWith("--id="))?.slice(5);

  if (fetchId) {
    const cookie = loadCookie();
    if (!cookie) {
      console.error("需要 LQ_COOKIE 或 cookie.local.txt 才能 --fetch");
      process.exit(1);
    }
    const id = parseInt(fetchId, 10);
    const url = `https://www.lanqiao.cn/api/v2/problems/${id}/`;
    const body = await fetchHttps(url, cookie);
    if (body.code === "not_authenticated") {
      console.error("认证失败");
      process.exit(2);
    }
    fs.mkdirSync(DETAIL_CACHE, { recursive: true });
    const p = path.join(DETAIL_CACHE, `${id}.json`);
    fs.writeFileSync(p, JSON.stringify(body, null, 2), "utf8");
    console.log("已拉取:", p);
    processDetail(p, body);
    return;
  }

  if (onlyId) {
    const id = parseInt(onlyId, 10);
    const p = findDetailJsonForId(id);
    if (!p) {
      console.error(`找不到题目 ${id} 的 detail.json，请先 collect 或使用 --fetch=${id}`);
      process.exit(1);
    }
    const detail = JSON.parse(fs.readFileSync(p, "utf8"));
    processDetail(p, detail);
    return;
  }

  const files = walkDetailJson(SRC_WEB).filter(
    (f) => !f.includes(`${path.sep}_raw${path.sep}`)
  );

  if (!files.length) {
    console.error("未找到 detail.json，请先运行 collect_problem_sources.mjs");
    process.exit(1);
  }

  let n = 0;
  for (const f of files) {
    const detail = JSON.parse(fs.readFileSync(f, "utf8"));
    if (processDetail(f, detail)) n++;
  }
  console.log(`完成，共导出 ${n} 道题目的题目描述.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
