/**
 * 成品导出（仅保留题目描述 + 本地图片 + 可执行 download.ps1 → CODE/）
 *
 * 输出：题库成品/Web前端/<考点>/<id>_<题目名>/
 *        题目描述.md
 *        download.ps1
 *        images/          （自动拉取 doc.shiyanlou 配图，避免预览 403）
 *        CODE/            （导出后自动执行 download.ps1 生成；也可用 --no-download 仅生成脚本）
 *
 * 前置：node build_lanqiao_topic_index.mjs
 * 认证：LQ_COOKIE 或 cookie.local.txt
 *
 * 用法：
 *   node export_final.mjs
 *   node export_final.mjs --limit=5
 *   node export_final.mjs --id=1766
 *   node export_final.mjs --no-download   # 不自动拉取 zip，只写 download.ps1
 */
import fs from "fs";
import path from "path";
import https from "https";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { mirrorMarkdownImages } from "./lib_mirror_images.mjs";
import { buildDownloadPs1FromDocument } from "./lib_download_ps1.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.join(ROOT, "题库成品", "Web前端");
const LIST_FILE = path.join(
  ROOT,
  "蓝桥真题考点索引",
  "Web前端",
  "全部题目清单.txt"
);

const META = new Set([
  "蓝桥杯",
  "Web 前端",
  "省赛",
  "国赛",
  "省模拟赛",
  "蓝桥杯备赛练习题",
]);

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

function sanitizeDirName(name) {
  const invalid = new Set('<>:"/\\|?*'.split(""));
  const s = [...name]
    .map((ch) => (invalid.has(ch) ? "_" : ch))
    .join("")
    .trim();
  return s || "_";
}

function parseListFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^\[(\d+)\]\s+/);
    if (!m) continue;
    const id = parseInt(m[1], 10);
    const afterId = line.slice(m[0].length);
    const pipeIdx = afterId.indexOf("|");
    if (pipeIdx === -1) {
      rows.push({ id, tags: [] });
      continue;
    }
    const rest = afterId.slice(pipeIdx + 1);
    const parts = rest.split("|").map((s) => s.trim());
    const tags = parts.filter(
      (p) => p && !p.startsWith("http") && !/^年份\s*:/.test(p)
    );
    rows.push({ id, tags });
  }
  return rows;
}

function skillTags(tags) {
  return tags.filter((t) => {
    if (!t || META.has(t)) return false;
    if (/^\d{4}$/.test(t)) return false;
    return true;
  });
}

function fetchJson(url, cookie) {
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
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch (e) {
              reject(e);
            }
          });
        }
      )
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 复制成品目录（不含 CODE，避免覆盖你已改动的源码） */
function copyProblemAssets(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    if (name === "CODE") continue;
    const s = path.join(srcDir, name);
    const d = path.join(dstDir, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) {
      copyProblemAssets(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function parseArgs(argv) {
  let limit = Infinity;
  const ids = new Set();
  let noDownload = false;
  for (const a of argv.slice(2)) {
    if (a.startsWith("--limit=")) limit = parseInt(a.slice(8), 10) || 0;
    if (a === "--no-download") noDownload = true;
    if (a.startsWith("--id=")) {
      for (const x of a.slice(5).split(",")) {
        const n = parseInt(x.trim(), 10);
        if (n) ids.add(n);
      }
    }
  }
  return { limit, ids, noDownload };
}

function runDownloadPs1(dir) {
  const ps1 = path.join(dir, "download.ps1");
  if (!fs.existsSync(ps1)) {
    return { ok: false, status: -1, stderr: "missing download.ps1" };
  }
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "download.ps1"],
    { cwd: dir, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  return {
    ok: r.status === 0,
    status: r.status ?? 1,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
  };
}

function copyDirRecursive(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyDirRecursive(path.join(src, name), path.join(dst, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

/** 将 firstDir/CODE 同步到多考点下的副本目录 */
function syncCodeToMirror(firstDir, destTopics, folderName) {
  const srcCode = path.join(firstDir, "CODE");
  if (!fs.existsSync(srcCode)) return;
  for (let ti = 1; ti < destTopics.length; ti++) {
    const topic = destTopics[ti];
    const dir = path.join(OUT_ROOT, sanitizeDirName(topic), folderName);
    const dstCode = path.join(dir, "CODE");
    if (fs.existsSync(dstCode)) fs.rmSync(dstCode, { recursive: true });
    copyDirRecursive(srcCode, dstCode);
  }
}

async function main() {
  const cookie = loadCookie();
  if (!cookie) {
    console.error("Need LQ_COOKIE or cookie.local.txt");
    process.exit(1);
  }

  if (!fs.existsSync(LIST_FILE)) {
    console.error("Missing:", LIST_FILE, "\nRun: node build_lanqiao_topic_index.mjs");
    process.exit(1);
  }

  const { limit, ids, noDownload } = parseArgs(process.argv);
  let rows = parseListFile(LIST_FILE);
  if (ids.size) {
    rows = rows.filter((r) => ids.has(r.id));
  } else {
    rows = rows.slice(0, limit);
  }

  const seen = new Map();
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.set(r.id, r);
  }
  const todo = [...seen.values()];

  console.log("Export count:", todo.length);

  let ok = 0;
  for (let i = 0; i < todo.length; i++) {
    const { id, tags } = todo[i];
    await sleep(280);
    const detail = await fetchJson(
      `https://www.lanqiao.cn/api/v2/problems/${id}/`,
      cookie
    );
    if (detail.code === "not_authenticated") {
      console.error("not_authenticated — check Cookie");
      process.exit(2);
    }

    const name = detail.name || String(id);
    const doc = detail.challenge?.document;
    const topics = skillTags(tags);
    const destTopics = topics.length ? topics : ["_无考点标签"];

    if (!doc) {
      console.warn(`[${id}] ${name} — no challenge.document, skip`);
      continue;
    }

    const folderName = `${id}_${sanitizeDirName(name)}`;
    const ps1 = buildDownloadPs1FromDocument(doc);
    let firstDir = null;
    let nImg = 0;

    for (let ti = 0; ti < destTopics.length; ti++) {
      const topic = destTopics[ti];
      const dir = path.join(OUT_ROOT, sanitizeDirName(topic), folderName);

      if (ti === 0) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "题目描述.md"), doc, "utf8");
        fs.writeFileSync(path.join(dir, "download.ps1"), ps1, "utf8");
        nImg = await mirrorMarkdownImages(path.join(dir, "题目描述.md"));
        firstDir = dir;
        console.log(`OK ${topic}/${folderName} (images: ${nImg})`);
      } else {
        copyProblemAssets(firstDir, dir);
        console.log(`OK ${topic}/${folderName} (copied from first topic)`);
      }
    }

    if (!noDownload && firstDir) {
      const dlr = runDownloadPs1(firstDir);
      if (dlr.ok) {
        console.log(`  CODE: ${path.relative(ROOT, path.join(firstDir, "CODE"))}`);
        syncCodeToMirror(firstDir, destTopics, folderName);
      } else {
        console.warn(
          `  download.ps1 failed (exit ${dlr.status}) for ${path.relative(ROOT, firstDir)}`
        );
        if (dlr.stderr) console.warn(dlr.stderr.trimEnd());
      }
    }
    ok++;
  }

  console.log("Finished. Output root:", OUT_ROOT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
