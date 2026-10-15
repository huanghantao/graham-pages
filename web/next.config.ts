import fs from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

/**
 * Next.js 配置 —— 静态导出（GitHub Pages）。
 *
 * 为什么是静态导出
 * ----------------
 * 本站的浏览路径本来就是纯读（见 README「读写路径分离」）：配额只在 ETL 时
 * 消耗，且与访问量无关。于是整个浏览体验等价于 `站点 = f(一份快照)` ——
 * 把 `f` 在构建时跑完，产物就是静态文件，不需要在线服务，也不需要把引擎
 * 或数据库交出去。
 *
 * 因此这里不再有 `output: "standalone"`（那是自部署容器用的），数据也不再
 * 来自 `GRAHAM_API_BASE`，而是构建期就在磁盘上的快照（见 `lib/snapshot.ts`）。
 *
 * ⚠️ 三条约束，全部由实测触发
 * ---------------------------
 * 1. `output: "export"` 下**路由处理器不被支持**（构建即报错）；
 *    `export const dynamic = "force-dynamic"` 与 `fetch(cache: "no-store")`
 *    同样会让导出失败。所以旧的同源代理与全站 no-store 取数都已移除。
 * 2. `trailingSlash: true` 让每个页面产出 `xxx/index.html`。GitHub Pages 按
 *    目录索引提供静态文件，没有它 `/stocks/600519.SH/` 这种带点的路径会
 *    命中不到文件。
 * 3. `basePath` 是项目页 URL 的必需项（`https://<user>.github.io/<repo>/`）。
 *    ★ 它**不会**自动作用于手写的 `fetch()` —— 需要前缀的地方必须显式拼上，
 *    见 `lib/base-path.ts`。少了这一步，⌘K 的索引请求会在项目页上 404，
 *    而首页一切正常，很容易漏掉。
 */
// 用 NEXT_PUBLIC_ 前缀：它同时被这里（构建期 Node）与浏览器产物读取，
// 从而只有**一个** basePath 来源。拆成两个变量（一个给 config、一个给
// 客户端）必然会有人只改其中一个，症状是"首页正常、子路径全 404"。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** 快照目录 —— 必须与 `lib/snapshot.ts` 的默认值一致。 */
const SNAPSHOT_DIR = path.join(process.cwd(), "public", "data");

/**
 * 构建前的快照哨兵。
 *
 * ★ 为什么必须有它：快照缺失时**构建依然成功** —— `lib/snapshot.ts` 读不到
 * 文件就返回 `null`，各页面于是渲染"尚无数据"的空态。结果是产出一个
 * **能打开、但处处空的站点**，而且从构建日志里看不出任何异常。
 *
 * 这个哨兵把"静默的空站"换成一条明确指令。触发它的典型场景有两个：
 * ① 忘了先跑发布；② 用 rsync 把源码同步到公开仓库时，快照被 `.gitignore`
 * 一起挡掉了 —— 后者的症状与前者一样，但更难想到。
 */
function assertSnapshotPresent(): void {
  const manifest = path.join(SNAPSHOT_DIR, "manifest.json");
  if (!fs.existsSync(manifest)) {
    throw new Error(
      [
        `缺少快照：${manifest}`,
        "",
        "静态站点在构建期读取快照，没有快照就会产出一个空的站点（且构建成功）。",
        "请先生成快照：",
        "",
        "    python -m graham.cli seed --demo --db data/demo.db   # 演示数据，无需密钥",
        "    python -m graham.cli publish --db data/demo.db --out web/public/data",
        "",
        "或用真实快照：python -m graham.cli publish --db data/graham.db --out web/public/data",
        "",
        "⚠️ 若这是公开仓库：请确认 public/data/ 未被 .gitignore 挡掉。",
      ].join("\n"),
    );
  }
}

assertSnapshotPresent();

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  // 静态导出没有服务端，按需图片优化不可能实现，必须关掉。
  images: { unoptimized: true },
};

export default nextConfig;
