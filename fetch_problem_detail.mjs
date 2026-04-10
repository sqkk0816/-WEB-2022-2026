/**
 * 在已登录状态下拉取单题详情 JSON（需浏览器 Cookie，仅本地使用）。
 *
 * 用法（PowerShell，Cookie 不要提交到 Git）：
 *   $env:LQ_COOKIE = "lqtoken=xxx; _SESSIONKEY=yyy; ..."
 *   node fetch_problem_detail.mjs 5133
 *
 * 输出：题目详情缓存/<id>.json
 *
 * 若返回 not_authenticated：检查 Cookie 是否过期，或改用浏览器 F12 从 Network 复制完整 Cookie。
 */
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, "题目详情缓存");

const id = process.argv[2];

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

const cookie = loadCookie();

if (!id || !/^\d+$/.test(id)) {
  console.error("用法: node fetch_problem_detail.mjs <题目ID>");
  process.exit(1);
}

if (!cookie) {
  console.error("请设置 LQ_COOKIE 或在项目根目录创建 cookie.local.txt（单行 Cookie）。");
  process.exit(1);
}

const url = `https://www.lanqiao.cn/api/v2/problems/${id}/`;

function fetchJson(u, headers) {
  return new Promise((resolve, reject) => {
    https
      .get(
        u,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/json",
            ...headers,
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            try {
              resolve({ status: res.statusCode, body: JSON.parse(text) });
            } catch {
              resolve({ status: res.statusCode, body: text });
            }
          });
        }
      )
      .on("error", reject);
  });
}

const { status, body } = await fetchJson(url, { Cookie: cookie });

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, `${id}.json`);
fs.writeFileSync(outFile, JSON.stringify(body, null, 2), "utf8");

console.log("HTTP", status);
console.log("已写入:", outFile);
if (body && typeof body === "object" && body.code === "not_authenticated") {
  console.error("提示: 未通过认证，请更新 Cookie 或确认账号已登录蓝桥云课。");
  process.exit(2);
}
