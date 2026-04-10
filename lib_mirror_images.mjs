/**
 * 将 题目描述.md 中 doc.shiyanlou.com 图片拉到 ./images/ 并改写链接（避免 403）
 */
import fs from "fs";
import path from "path";
import https from "https";

const REFERER = "https://www.lanqiao.cn/";

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: REFERER,
            Accept: "image/webp,image/*,*/*",
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            download(res.headers.location).then(resolve).catch(reject);
            return;
          }
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            resolve({
              status: res.statusCode,
              buf: Buffer.concat(chunks),
              type: res.headers["content-type"] || "",
            });
          });
        }
      )
      .on("error", reject);
  });
}

function extFromType(ct) {
  if (!ct) return ".bin";
  if (ct.includes("jpeg")) return ".jpg";
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("svg")) return ".svg";
  return ".img";
}

/** @returns {Promise<number>} number of images saved */
export async function mirrorMarkdownImages(mdPath) {
  let text = fs.readFileSync(mdPath, "utf8");
  const dir = path.dirname(mdPath);
  const imgDir = path.join(dir, "images");
  const re = /!\[([^\]]*)\]\((https:\/\/doc\.shiyanlou\.com[^)]+)\)/g;
  const matches = [...text.matchAll(re)];
  if (!matches.length) return 0;

  fs.mkdirSync(imgDir, { recursive: true });
  let n = 0;
  let idx = 0;
  for (const m of matches) {
    const alt = m[1];
    const url = m[2];
    idx++;
    const parts = url.split("/").filter(Boolean);
    const idPart = parts.length >= 2 ? parts[parts.length - 2] : `${idx}`;
    const safe = idPart.replace(/[^a-zA-Z0-9._-]/g, "_");

    try {
      const { status, buf, type } = await download(url);
      if (status !== 200 || !buf.length) {
        console.warn(`  image FAIL ${status} ${url.slice(0, 72)}`);
        continue;
      }
      const ext = extFromType(type);
      const base = safe.endsWith(ext) ? safe : safe + ext;
      const rel = path.join("images", base).replace(/\\/g, "/");
      const out = path.join(imgDir, base);
      fs.writeFileSync(out, buf);
      const newTag = `![${alt}](./${rel})`;
      const pos = text.indexOf(m[0]);
      if (pos !== -1) {
        text = text.slice(0, pos) + newTag + text.slice(pos + m[0].length);
      }
      n++;
      console.log(`  image OK ./${rel}`);
    } catch (e) {
      console.warn(`  image ERR ${url}`, e.message);
    }
  }

  if (n > 0) {
    fs.writeFileSync(mdPath, text, "utf8");
  }
  return n;
}
