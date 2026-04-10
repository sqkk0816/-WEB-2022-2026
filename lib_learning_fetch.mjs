/**
 * 从题目「学习页」HTML 内嵌的 __NUXT__ 中解析 question_stem（Markdown 题面）。
 * 学习页示例：https://www.lanqiao.cn/problems/5137/learning/
 */
import https from "https";

function fetchText(url, cookie) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "text/html,application/xhtml+xml",
            Cookie: cookie,
            Referer: "https://www.lanqiao.cn/problems/",
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () =>
            resolve(Buffer.concat(chunks).toString("utf8"))
          );
        }
      )
      .on("error", reject);
  });
}

/**
 * 从 __NUXT__ 脚本块中提取 question_stem 字符串（处理 \\n \\u0022 等转义）
 */
export function extractQuestionStemFromLearningHtml(html) {
  const marker = "question_stem:";
  const i = html.indexOf(marker);
  if (i === -1) return null;

  let pos = i + marker.length;
  while (pos < html.length && /\s/.test(html[pos])) pos++;
  if (html[pos] !== '"') return null;
  pos++;

  let out = "";
  while (pos < html.length) {
    const ch = html[pos];
    if (ch === '"') break;
    if (ch === "\\") {
      const next = html[pos + 1];
      if (next === "n") {
        out += "\n";
        pos += 2;
        continue;
      }
      if (next === "r") {
        out += "\r";
        pos += 2;
        continue;
      }
      if (next === "t") {
        out += "\t";
        pos += 2;
        continue;
      }
      if (next === '"' || next === "\\" || next === "'") {
        out += next;
        pos += 2;
        continue;
      }
      if (next === "u" && /^[0-9a-fA-F]{4}/.test(html.slice(pos + 2, pos + 6))) {
        const hex = html.slice(pos + 2, pos + 6);
        out += String.fromCharCode(parseInt(hex, 16));
        pos += 6;
        continue;
      }
      out += ch;
      pos++;
      continue;
    }
    out += ch;
    pos++;
  }
  return out;
}

export async function fetchQuestionStemFromLearning(problemId, cookie) {
  const url = `https://www.lanqiao.cn/problems/${problemId}/learning/`;
  const html = await fetchText(url, cookie);
  const stem = extractQuestionStemFromLearningHtml(html);
  return { html, stem, url };
}
