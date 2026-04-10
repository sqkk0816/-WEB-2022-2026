/**
 * 从蓝桥云课公开 API 拉取题库，筛选近五年（2022–2026），按标签建文件夹与索引。
 * Web 前端: /api/v2/problems/?first_category_id=2&second_category_id=11
 * 算法大学组 PC(B): /api/v2/problems/pc/?first_category_id=1&second_category_id=3
 * 运行: node build_lanqiao_topic_index.mjs
 */
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "蓝桥真题考点索引");
const YEARS = new Set(["2022", "2023", "2024", "2025", "2026"]);

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } },
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

function sanitizeDirName(name) {
  const invalid = new Set('<>:"/\\|?*'.split(""));
  return (
    [...name]
      .map((ch) => (invalid.has(ch) ? "_" : ch))
      .join("")
      .trim() || "_未命名考点"
  );
}

/** @param {string} baseUrl 含 page_size */
async function fetchPagedResults(baseUrl, key) {
  const all = [];
  let page = 1;
  while (true) {
    const j = await get(`${baseUrl}&page=${page}`);
    const chunk = j[key];
    if (!chunk?.length) break;
    all.push(...chunk);
    if (chunk.length < (j.page_size || 100)) break;
    page++;
  }
  return all;
}

const WEB_BASE =
  "https://www.lanqiao.cn/api/v2/problems/?first_category_id=2&second_category_id=11&page_size=100";
const PC_BASE =
  "https://www.lanqiao.cn/api/v2/problems/pc/?first_category_id=1&second_category_id=3&page_size=100";

const META_WEB = new Set([
  "蓝桥杯",
  "Web 前端",
  "省赛",
  "国赛",
  "省模拟赛",
  "蓝桥杯备赛练习题",
]);

const META_PC = new Set(["省赛", "国赛", "省模拟赛"]);

function filterRecent(items) {
  return items.filter((it) => (it.tags || []).some((t) => YEARS.has(t)));
}

/**
 * @param {any[]} recent
 * @param {Set<string>} meta
 */
function buildByTopic(recent, meta) {
  /** @type {Map<string, Set<number>>} */
  const byTopic = new Map();
  for (const item of recent) {
    for (const tag of item.tags || []) {
      if (!tag || meta.has(tag) || /^\d{4}$/.test(tag)) continue;
      if (!byTopic.has(tag)) byTopic.set(tag, new Set());
      byTopic.get(tag).add(item.id);
    }
  }
  return byTopic;
}

function writeBundle(subDir, title, recent, byTopic) {
  const base = path.join(OUT, subDir);
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });

  const summary = [];
  summary.push(title);
  summary.push("筛选：标签含 2022–2026 任一年份");
  summary.push(`拉取时间：${new Date().toISOString()}`);
  summary.push(`题目条数：${recent.length}`);
  summary.push(`题目 id 去重数：${new Set(recent.map((x) => x.id)).size}`);
  summary.push(`考点文件夹数：${byTopic.size}`);
  summary.push("");
  summary.push("--- 考点题目数量 ---");
  const sortedTopics = [...byTopic.entries()].sort((a, b) => b[1].size - a[1].size);
  for (const [k, s] of sortedTopics) {
    summary.push(`${k}\t${s.size}`);
  }
  fs.writeFileSync(path.join(base, "00_总览.txt"), summary.join("\n"), "utf8");

  const allLines = recent
    .sort((a, b) => a.id - b.id)
    .map((item) => {
      const ys = (item.tags || []).filter((t) => /^\d{4}$/.test(t)).join(",");
      const tags = (item.tags || []).join(" | ");
      return `[${item.id}] ${item.name} | 年份: ${ys} | ${tags} | https://www.lanqiao.cn/problems/${item.id}/`;
    });
  fs.writeFileSync(path.join(base, "全部题目清单.txt"), allLines.join("\n"), "utf8");

  for (const [topic, idSet] of sortedTopics) {
    const dir = path.join(base, sanitizeDirName(topic));
    fs.mkdirSync(dir, { recursive: true });
    const ids = [...idSet].sort((a, b) => a - b);
    const lines = [`考点：${topic}`, `题目数：${ids.length}`, ""];
    for (const id of ids) {
      const item = recent.find((x) => x.id === id);
      if (!item) continue;
      const ys = (item.tags || []).filter((t) => /^\d{4}$/.test(t)).join(",");
      lines.push(`[${id}] ${item.name} | 年份: ${ys} | https://www.lanqiao.cn/problems/${id}/`);
    }
    fs.writeFileSync(path.join(dir, "题目索引.txt"), lines.join("\n"), "utf8");
  }
}

if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const webItems = await fetchPagedResults(WEB_BASE, "results");
const webRecent = filterRecent(webItems);
const webTopics = buildByTopic(webRecent, META_WEB);
writeBundle(
  "Web前端",
  "蓝桥云课 Web 前端（first_category_id=2, second_category_id=11）",
  webRecent,
  webTopics
);

const pcItems = await fetchPagedResults(PC_BASE, "data");
const pcRecent = filterRecent(pcItems);
const pcTopics = buildByTopic(pcRecent, META_PC);
writeBundle(
  "算法_大学组PCB",
  "蓝桥云课 算法 · 大学组 · PC(B)（first_category_id=1, second_category_id=3，接口 /problems/pc/）",
  pcRecent,
  pcTopics
);

const readme = [
  "本目录由 build_lanqiao_topic_index.mjs 从蓝桥云课公开接口生成。",
  "",
  "子目录：",
  "  Web前端/ —— Web 前端题库近五年题目，按标签（考点）分子文件夹。",
  "  算法_大学组PCB/ —— 大学组 PC(B) 组算法题库近五年题目，按算法/知识点标签分子文件夹。",
  "",
  "题目链接：https://www.lanqiao.cn/problems/{id}/",
  "",
  "说明：考点名称来自题库标签；同一题可出现在多个考点文件夹中。",
].join("\n");
fs.writeFileSync(path.join(OUT, "README.txt"), readme, "utf8");

console.log("OK:", OUT);
console.log("Web前端 近五年:", webRecent.length, "考点文件夹:", webTopics.size);
console.log("算法PCB 近五年:", pcRecent.length, "考点文件夹:", pcTopics.size);
