/**
 * 一键：刷新索引 → export_final → 每题唯一目录执行 download.ps1 → verify_report.txt
 *
 * 用法:
 *   node automate_export.mjs
 *   node automate_export.mjs --limit=5
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const KU = path.join(ROOT, "题库成品", "Web前端");
const LIST_FILE = path.join(
  ROOT,
  "蓝桥真题考点索引",
  "Web前端",
  "全部题目清单.txt"
);

/** 与 export_final.mjs 一致：先 slice(0, limit) 再按 id 去重保留首次出现顺序 */
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

function getTargetIds(limit) {
  if (!fs.existsSync(LIST_FILE)) return [];
  const rows = parseListFile(LIST_FILE).slice(0, limit);
  const seen = new Map();
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.set(r.id, r);
  }
  return [...seen.keys()];
}

/** 默认 3 题；--limit=0 表示全量（与 export_final 的 slice(0,∞) 一致） */
function parseLimit(argv) {
  const a = argv.find((x) => x.startsWith("--limit="));
  if (!a) return 3;
  const n = parseInt(a.slice(8), 10);
  if (!Number.isFinite(n) || n <= 0) return Number.POSITIVE_INFINITY;
  return n;
}

function runNode(script, args = []) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
  };
}

/** topicDir 下形如 1762_搜一搜呀 的目录，按 id 去重只保留字典序第一条路径 */
function collectProblemDirsById() {
  /** @type {Map<string, string[]>} */
  const byId = new Map();
  if (!fs.existsSync(KU)) return byId;
  for (const topic of fs.readdirSync(KU)) {
    const tpath = path.join(KU, topic);
    if (!fs.statSync(tpath).isDirectory()) continue;
    for (const name of fs.readdirSync(tpath)) {
      const m = name.match(/^(\d+)_(.+)$/);
      if (!m) continue;
      const id = m[1];
      const full = path.join(tpath, name);
      if (!fs.statSync(full).isDirectory()) continue;
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(full);
    }
  }
  return byId;
}

function pickCanonicalDir(paths) {
  return [...paths].sort()[0];
}

function verifyProblemDir(dir, lines) {
  const md = path.join(dir, "题目描述.md");
  const imgDir = path.join(dir, "images");
  const codeDir = path.join(dir, "CODE");

  const rel = path.relative(ROOT, dir);
  if (!fs.existsSync(md)) {
    lines.push(`[MISS] ${rel} 无 题目描述.md`);
    return;
  }
  const text = fs.readFileSync(md, "utf8");
  const remoteImg = (text.match(/https:\/\/doc\.shiyanlou\.com/g) || []).length;
  if (remoteImg > 0) {
    lines.push(`[IMG] ${rel} 仍有 ${remoteImg} 处 doc.shiyanlou.com 远程图（预览可能 403）`);
  } else {
    lines.push(`[IMG] ${rel} 题目描述中无远程图链接`);
  }

  if (fs.existsSync(imgDir)) {
    const files = fs.readdirSync(imgDir);
    lines.push(`[IMG] ${rel} images/ 文件数: ${files.length}`);
  } else {
    lines.push(`[IMG] ${rel} 无 images/（本题可能无配图）`);
  }

  if (fs.existsSync(codeDir)) {
    const countFiles = (d) => {
      let n = 0;
      for (const n0 of fs.readdirSync(d)) {
        const p = path.join(d, n0);
        if (fs.statSync(p).isDirectory()) n += countFiles(p);
        else n++;
      }
      return n;
    };
    const n = countFiles(codeDir);
    if (n > 0) {
      lines.push(`[CODE] ${rel} CODE/ 文件数: ${n}`);
    } else {
      lines.push(`[CODE] ${rel} CODE/ 为空`);
    }
  } else {
    lines.push(`[CODE] ${rel} 无 CODE/（未运行 download.ps1 或题目无 zip）`);
  }
}

function main() {
  const limit = parseLimit(process.argv);
  const report = [];
  report.push(`automate_export ${new Date().toISOString()}`);
  report.push(`limit=${limit}`);
  report.push("");

  report.push("==> build_lanqiao_topic_index.mjs");
  let r = runNode("build_lanqiao_topic_index.mjs");
  report.push(r.stdout.trimEnd());
  if (r.stderr) report.push(r.stderr.trimEnd());
  if (r.status !== 0) {
    report.push(`EXIT ${r.status}`);
    fs.writeFileSync(path.join(ROOT, "题库成品", "verify_report.txt"), report.join("\n"), "utf8");
    process.exit(r.status || 1);
  }

  report.push("");
  const exportArgs =
    limit === Number.POSITIVE_INFINITY ? [] : [`--limit=${limit}`];
  report.push(
    exportArgs.length
      ? `==> export_final.mjs ${exportArgs[0]}`
      : "==> export_final.mjs (full list)"
  );
  r = runNode("export_final.mjs", exportArgs);
  report.push(r.stdout.trimEnd());
  if (r.stderr) report.push(r.stderr.trimEnd());
  if (r.status !== 0) {
    report.push(`EXIT ${r.status}`);
    fs.mkdirSync(path.join(ROOT, "题库成品"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "题库成品", "verify_report.txt"), report.join("\n"), "utf8");
    process.exit(r.status || 1);
  }

  report.push("");
  report.push("==> download.ps1 (one per problem id, this run only)");

  const byId = collectProblemDirsById();
  const targetIds = getTargetIds(limit).map(String);
  if (!targetIds.length) {
    report.push("[WARN] 无法从清单解析题目 id，跳过 download");
  }

  for (const id of targetIds) {
    const paths = byId.get(id);
    if (!paths || !paths.length) {
      report.push(`[SKIP] id=${id} 成品目录未找到（导出可能跳过无 document）`);
      continue;
    }
    const dir = pickCanonicalDir(paths);
    const ps1 = path.join(dir, "download.ps1");
    const rel = path.relative(ROOT, dir);
    if (!fs.existsSync(ps1)) {
      report.push(`[SKIP] ${rel} 无 download.ps1`);
      continue;
    }
    const pr = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "download.ps1"],
      { cwd: dir, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    );
    const out = (pr.stdout || "").trim();
    const err = (pr.stderr || "").trim();
    if (out) report.push(out);
    if (err) report.push(err);
    if (pr.status !== 0) {
      report.push(`[ERR] ${rel} download.ps1 exit ${pr.status}`);
    } else {
      report.push(`[OK] ${rel} download.ps1`);
    }
  }

  report.push("");
  report.push("==> verify");

  for (const id of targetIds) {
    const paths = byId.get(id);
    if (!paths || !paths.length) {
      report.push(`[VERIFY] id=${id} 无目录可校验`);
      continue;
    }
    const dir = pickCanonicalDir(paths);
    verifyProblemDir(dir, report);
  }

  fs.mkdirSync(path.join(ROOT, "题库成品"), { recursive: true });
  const outFile = path.join(ROOT, "题库成品", "verify_report.txt");
  fs.writeFileSync(outFile, report.join("\n"), "utf8");
  console.log(report.join("\n"));
  console.log("\nWrote:", outFile);
}

main();
