/**
 * （已由 export_final + automate_export 替代成品流程；保留脚本供历史/特殊拉取。）
 * 使用本机 Cookie 批量拉取题目详情 + 实验（lab）数据，并按考点文件夹落盘。
 *
 * 前置：
 *   1. 已运行 node build_lanqiao_topic_index.mjs 生成「蓝桥真题考点索引」
 *   2. Cookie 任选其一：
 *        $env:LQ_COOKIE = "lqtoken=...; _SESSIONKEY=..."
 *        或在项目根目录创建 cookie.local.txt（单行，整串 Cookie），已加入 .gitignore
 *
 * 用法：
 *   node collect_problem_sources.mjs                 # 仅 Web 前端近五年清单中的题目
 *   node collect_problem_sources.mjs algo          # 仅 算法_大学组PCB 清单
 *   node collect_problem_sources.mjs web --limit=5 # 只拉前 5 道（试跑）
 *   node collect_problem_sources.mjs web --id=5133,1766
 *
 * 输出：
 *   题目详情缓存/<id>.json           — 题目详情 API 原文
 *   题目源码/<赛道>/<考点>/<id>/     — 按考点复制 detail.json、lab.json 等
 *   题目源码/<赛道>/_raw/<id>/       — 额外尝试的接口响应（便于排查）
 *
 * 说明：contest_oj 且 lab_id 为 null 的题目，平台可能不提供可下载「工程源码」，
 *       仅会有 detail.json；实验类（有 lab_id）会尽量拉取 /api/v2/labs/{lab_id}/
 */
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DETAIL_DIR = path.join(ROOT, "题目详情缓存");
const SRC_ROOT = path.join(ROOT, "题目源码");

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

function parseArgs(argv) {
  const rest = argv.slice(2);
  const positional = rest.filter((a) => !a.startsWith("--"));
  const mode = positional[0] === "algo" ? "algo" : "web";
  let limit = Infinity;
  const ids = new Set();
  for (const a of rest) {
    if (a.startsWith("--limit=")) limit = parseInt(a.slice(8), 10) || 0;
    if (a.startsWith("--id=")) {
      for (const x of a.slice(5).split(",")) {
        const n = parseInt(x.trim(), 10);
        if (n) ids.add(n);
      }
    }
  }
  return { mode, limit, ids };
}

function sanitizeDirName(name) {
  const invalid = new Set('<>:"/\\|?*'.split(""));
  const s = [...name]
    .map((ch) => (invalid.has(ch) ? "_" : ch))
    .join("")
    .trim();
  return s || "_";
}

function fetchHttps(url, cookie) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/json, text/plain, */*",
            Cookie: cookie,
            Referer: "https://www.lanqiao.cn/problems/",
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const buf = Buffer.concat(chunks);
            const text = buf.toString("utf8");
            let body;
            try {
              body = JSON.parse(text);
            } catch {
              body = text;
            }
            resolve({ status: res.statusCode, body, rawText: text });
          });
        }
      )
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseListFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error("找不到清单文件:", filePath);
    console.error("请先运行: node build_lanqiao_topic_index.mjs");
    process.exit(1);
  }
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

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function copyFile(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

/** 部分 OJ 题可能有 /problems/{id}/oj/ 补充信息，失败可忽略 */
async function tryFetchOjSupplement(id, cookie, rawDir) {
  await sleep(200);
  const url = `https://www.lanqiao.cn/api/v2/problems/${id}/oj/`;
  const { status, body } = await fetchHttps(url, cookie);
  const base = path.join(rawDir, `oj_supplement_${status}`);
  if (typeof body === "object" && body !== null) {
    writeJson(`${base}.json`, body);
  } else {
    fs.writeFileSync(`${base}.txt`, String(body), "utf8");
  }
}

async function main() {
  const cookie = loadCookie();
  if (!cookie) {
    console.error("未找到 Cookie：请设置 LQ_COOKIE 或创建 cookie.local.txt");
    process.exit(1);
  }

  const { mode, limit, ids: onlyIds } = parseArgs(process.argv);
  const listRel =
    mode === "algo"
      ? path.join("蓝桥真题考点索引", "算法_大学组PCB", "全部题目清单.txt")
      : path.join("蓝桥真题考点索引", "Web前端", "全部题目清单.txt");
  const listPath = path.join(ROOT, listRel);
  const trackName = mode === "algo" ? "算法_大学组PCB" : "Web前端";

  const rows = parseListFile(listPath);
  let todo = rows;
  if (onlyIds.size) {
    todo = rows.filter((r) => onlyIds.has(r.id));
  } else {
    todo = rows.slice(0, limit);
  }

  const uniq = [];
  const seen = new Set();
  for (const r of todo) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    uniq.push(r);
  }

  console.log(`赛道: ${trackName}, 待拉取: ${uniq.length} 道题`);

  ensureDir(DETAIL_DIR);
  ensureDir(SRC_ROOT);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < uniq.length; i++) {
    const { id, tags } = uniq[i];
    const topics = skillTags(tags);
    console.log(`[${i + 1}/${uniq.length}] id=${id} ${topics.join(",") || "(无考点标签)"}`);

    await sleep(300);
    const detailUrl = `https://www.lanqiao.cn/api/v2/problems/${id}/`;
    const { status, body } = await fetchHttps(detailUrl, cookie);

    if (typeof body === "object" && body?.code === "not_authenticated") {
      console.error("  认证失败，停止。请更新 Cookie。");
      process.exit(2);
    }

    const detailPath = path.join(DETAIL_DIR, `${id}.json`);
    writeJson(detailPath, body);

    const rawDir = path.join(SRC_ROOT, trackName, "_raw", String(id));
    ensureDir(rawDir);
    writeJson(path.join(rawDir, "detail.json"), body);

    const labId = body?.lab_id;
    let labPayload = null;
    if (labId) {
      await sleep(300);
      const labUrl = `https://www.lanqiao.cn/api/v2/labs/${labId}/`;
      const lr = await fetchHttps(labUrl, cookie);
      labPayload = lr.body;
      writeJson(path.join(rawDir, `lab_${lr.status}.json`), labPayload);
      if (typeof labPayload === "object" && labPayload?.code === "not_authenticated") {
        console.warn("  lab 接口未认证");
      }
    }

    await tryFetchOjSupplement(id, cookie, rawDir);

    const note = [];
    if (!labId && body?.type === "contest_oj") {
      note.push("本题无 lab_id：通常为在线 OJ，工程源码可能仅在网页/评测环境内，无单独压缩包。");
    }
    if (topics.length === 0) {
      note.push("无技能标签，已放入文件夹 _无考点标签。");
    }

    const destTopics = topics.length ? topics : ["_无考点标签"];
    for (const topic of destTopics) {
      const dest = path.join(SRC_ROOT, trackName, sanitizeDirName(topic), String(id));
      ensureDir(dest);
      copyFile(detailPath, path.join(dest, "detail.json"));
      if (labId && labPayload && typeof labPayload === "object" && !labPayload.code) {
        writeJson(path.join(dest, "lab.json"), labPayload);
      }
      if (note.length) {
        fs.writeFileSync(path.join(dest, "说明.txt"), note.join("\n"), "utf8");
      }
    }

    if (status === 200 && body && typeof body === "object" && !body.code) ok++;
    else fail++;
  }

  console.log(`完成。成功写入详情: ${ok}, 异常: ${fail}`);
  console.log(`输出根目录: ${path.join(SRC_ROOT, trackName)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
