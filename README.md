# 蓝桥杯 Web 近五年真题（2022–2026）

本仓库收录 **蓝桥杯「Web 前端」方向**、题目标签中 **年份为 2022–2026** 的近五年真题整理结果：每题包含 **题目描述**、**本地配图**（`./images/`）及 **初始源码**（`CODE/`，由官方实验包 zip 解压得到）。

> 题目与材料版权归蓝桥 / 相关出题方所有，本仓库仅供个人学习整理，请勿用于商业用途。

## 目录结构

成品数据位于：

```
蓝桥杯WEB近5年真题（2022-2026）/
└── Web前端/
    └── <考点标签>/          # 如 Vue.js、CSS3、JavaScript 等
        └── <id>_<题目名>/
            ├── 题目描述.md   # Markdown 题干（配图已镜像为本地路径）
            ├── images/       # 题目配图
            ├── download.ps1  # 从官方 OSS 拉取 zip 的脚本（可选）
            └── CODE/         # 解压后的 starter 代码
```

同一题目可能出现在多个考点目录下（标签重复），内容以其中一份为准即可。

## 「近五年」指哪几年？

与索引脚本中的筛选一致：**2022、2023、2024、2025、2026**（以题目标签中的年份为准）。

## 本地如何重新拉取（可选）

若你克隆了本仓库的**完整脚本**（如 `export_final.mjs`、`automate_export.mjs`、`run_all.ps1` 等），可在项目根目录：

1. 在浏览器登录 [蓝桥云课](https://www.lanqiao.cn/)，在开发者工具中复制 **Cookie**。
2. 在仓库根目录创建 **`cookie.local.txt`**（单行 Cookie）或设置环境变量 **`LQ_COOKIE`**。
3. 执行：

   ```powershell
   .\run_all.ps1 -Limit 0     # 全量：刷新索引 → 导出 → 下载 CODE → 生成 verify_report.txt
   .\run_all.ps1 -Limit 10    # 仅清单前 10 题（试跑）
   ```

   `cookie.local.txt` 已加入 `.gitignore`，**请勿提交到 Git**。

## 说明

- 部分题目若无实验文档（`challenge.document`），导出脚本可能无法生成完整 `题目描述.md` 或 `CODE/`，以 `verify_report.txt`（若存在）为准。
- 配图域名 `doc.shiyanlou.com` 在预览中可能 403，成品中已尽量替换为本地 `./images/`。

## 仓库

- 远程：`https://github.com/sqkk0816/-WEB-2022-2026`
