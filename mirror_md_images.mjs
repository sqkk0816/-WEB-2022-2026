/**
 * 将 题目描述.md 中 doc.shiyanlou.com 图片下载到本地 images/（逻辑见 lib_mirror_images.mjs）
 *
 * 用法:
 *   node mirror_md_images.mjs
 *   node mirror_md_images.mjs "题库成品/Web前端/CSS3/1766_个人博客/题目描述.md"
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mirrorMarkdownImages } from "./lib_mirror_images.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function walkDir(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkDir(p, acc);
    else if (name === "题目描述.md") acc.push(p);
  }
  return acc;
}

const arg = process.argv[2];
const roots = [path.join(ROOT, "题库成品"), path.join(ROOT, "题目源码")];
const files = arg
  ? [path.resolve(ROOT, arg)]
  : roots.flatMap((r) => (fs.existsSync(r) ? walkDir(r) : []));

if (!files.length) {
  console.error("No 题目描述.md found. Pass a file or ensure 题库成品/ exists.");
  process.exit(1);
}

let total = 0;
for (const f of files) {
  console.log(f);
  total += await mirrorMarkdownImages(f);
}
console.log(`Done. Mirrored ${total} images total.`);
