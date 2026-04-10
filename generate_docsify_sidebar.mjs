/**
 * 扫描「蓝桥杯WEB近5年真题（2022-2026）/Web前端」下所有 题目描述.md，生成 Docsify 用 _sidebar.md
 * 运行: node generate_docsify_sidebar.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(ROOT, "蓝桥杯WEB近5年真题（2022-2026）", "Web前端");
const OUT = path.join(WEB, "_sidebar.md");

function readTitle(mdPath) {
  try {
    const text = fs.readFileSync(mdPath, "utf8");
    const line = text.split(/\r?\n/).find((l) => /^#\s+/.test(l.trim()));
    if (line) return line.replace(/^#+\s*/, "").trim();
  } catch {
    /* ignore */
  }
  return "";
}

function collect() {
  /** @type {{ topic: string; id: number; dirName: string; title: string; rel: string }[]} */
  const rows = [];
  if (!fs.existsSync(WEB)) {
    console.error("Missing:", WEB);
    process.exit(1);
  }
  for (const topic of fs.readdirSync(WEB)) {
    if (topic.startsWith(".") || topic === "node_modules") continue;
    const tpath = path.join(WEB, topic);
    if (!fs.statSync(tpath).isDirectory()) continue;
    for (const dirName of fs.readdirSync(tpath)) {
      const m = dirName.match(/^(\d+)_(.+)$/);
      if (!m) continue;
      const id = parseInt(m[1], 10);
      const md = path.join(tpath, dirName, "题目描述.md");
      if (!fs.existsSync(md)) continue;
      const title = readTitle(md) || dirName;
      const rel = [topic, dirName, "题目描述.md"].join("/");
      rows.push({ topic, id, dirName, title, rel });
    }
  }
  rows.sort((a, b) =>
    a.topic !== b.topic ? a.topic.localeCompare(b.topic, "zh-CN") : a.id - b.id
  );
  return rows;
}

function main() {
  const rows = collect();
  const lines = [];
  lines.push(`* [首页](/README.md)`);
  lines.push("");
  let lastTopic = "";
  for (const r of rows) {
    if (r.topic !== lastTopic) {
      if (lastTopic !== "") lines.push("");
      lines.push(`* **${r.topic}**`);
      lastTopic = r.topic;
    }
    const label = r.title.replace(/\s+/g, " ").slice(0, 80);
    lines.push(`  * [${label}](/${r.rel})`);
  }
  lines.push("");
  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log("Wrote:", OUT);
  console.log("Problems:", rows.length, "topics:", new Set(rows.map((x) => x.topic)).size);
}

main();
