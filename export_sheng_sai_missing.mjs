/**
 * 导出「省赛收录说明」中尚未收录的 57 道题到
 *   蓝桥杯WEB近5年真题（2022-2026）/Web前端/
 *
 * 前置：根目录 cookie.local.txt 或 LQ_COOKIE；建议先执行 node build_lanqiao_topic_index.mjs
 *
 * 用法：node export_sheng_sai_missing.mjs
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_REL = "蓝桥杯WEB近5年真题（2022-2026）/Web前端";

function missingShengSaiIds() {
  const a = [];
  for (let n = 5133; n <= 5144; n++) a.push(n);
  a.push(7325, 7326, 7328);
  for (let n = 18554; n <= 18581; n++) a.push(n);
  for (let n = 20683; n <= 20696; n++) a.push(n);
  return a;
}

const ids = missingShengSaiIds();
console.log("Will export", ids.length, "problems to", OUT_REL);

const r0 = spawnSync(process.execPath, [path.join(ROOT, "build_lanqiao_topic_index.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});
if (r0.status !== 0) process.exit(r0.status ?? 1);

const r = spawnSync(
  process.execPath,
  [
    path.join(ROOT, "export_final.mjs"),
    `--out=${OUT_REL}`,
    `--id=${ids.join(",")}`,
  ],
  { cwd: ROOT, stdio: "inherit", maxBuffer: 50 * 1024 * 1024 }
);
console.log("\nDone. Regenerate Docsify sidebar: node generate_docsify_sidebar.mjs");
process.exit(r.status ?? 1);
