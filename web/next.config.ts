import fs from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

/**
 * Next.js 配置 —— 静态导出（GitHub Pages）。
 *
 * 为什么是静态导出
 * ----------------
 * 本站的数据在构建期就已确定：读一份随仓库发布的快照，页面一次性渲染成
 * HTML。于是整个站点等价于 `站点 = f(一份快照)` —— 把 `f` 在构建时跑完，
 * 产物就是静态文件，运行时不依赖任何在线服务。
 *
 * 因此这里没有 `output: "standalone"`（那是自部署容器用的）：本站产出的是
 * 纯静态文件，不是需要 Node 运行时的应用。数据来自构建期就在磁盘上的快照
 * （见 `lib/snapshot.ts`）。
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
 * 构建前的哨兵 —— 两份一致性检查。
 *
 * ★ 检查一：**快照必须存在**。快照缺失时构建依然成功 —— `lib/snapshot.ts`
 * 读不到文件就返回 `null`，各页面于是渲染"尚无数据"的空态。结果是产出一个
 * **能打开、但处处空的站点**，而从构建日志里看不出任何异常。两种典型触发：
 * ① 忘了先生成快照；② `public/data/` 被 `.gitignore` 挡掉而没进仓库。
 *
 * ★ 检查二：**界面档案必须与快照档案一致**。界面由 `NEXT_PUBLIC_UI_PROFILE`
 * 决定显示哪些表面，快照由 `graham publish --profile` 决定发布哪些产物。
 * 两者错配的后果不对称：
 *   * 公开界面 + 工作台快照 → 快照里多出用不到的产物，只是浪费体积；
 *   * 工作台界面 + 公开快照 → 导航里有策略入口、点进去却是 404，**这是坏的**。
 * 与其推理哪种错配更可能发生，不如让不一致时直接构建失败。
 */
function assertSnapshotUsable(): void {
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
        "⚠️ 请确认 public/data/ 未被 .gitignore 挡掉（否则快照不会进仓库）。",
      ].join("\n"),
    );
  }

  const raw = JSON.parse(fs.readFileSync(manifest, "utf-8")) as {
    profile?: { profile?: string };
  };
  const snapshotProfile = raw.profile?.profile;
  const uiProfile = process.env.NEXT_PUBLIC_UI_PROFILE ?? "workbench";
  if (snapshotProfile && snapshotProfile !== uiProfile) {
    throw new Error(
      [
        `发布档案不一致：快照是 ${snapshotProfile}，界面是 ${uiProfile}。`,
        "",
        "界面由 NEXT_PUBLIC_UI_PROFILE 决定显示哪些表面，",
        "快照由 graham publish --profile 决定发布哪些产物，两者必须一致。",
        "不一致时的典型症状：导航里有入口、点进去却是 404。",
        "",
        `重新生成匹配的快照：graham publish --profile ${uiProfile} --out web/public/data`,
      ].join("\n"),
    );
  }
}

assertSnapshotUsable();


/**
 * 当前档案是否有服务端。
 *
 * ★ 这一项决定 `output`：有服务端 → 默认构建（Route Handler / Server Action
 * 可用）；无服务端 → `"export"`（纯静态文件，两者都不存在）。
 *
 * 为什么必须按档案区分，而不是永远 `"export"`：工作台需要一个能执行写操作
 * 的运行时（发布页要起子进程、写目标仓），而公开站**必须不能**有 —— 它有
 * 就等于把写路径暴露在公网上。同一份源码要同时满足这两条，只能让部署形态
 * 跟着档案走。
 *
 * ⚠️ 直接读 JSON 而不是 import `lib/ui-profile.ts`：本文件在 Node 里加载，
 * 走的是 Next 自己的配置加载器，不保证能解析路径别名（`@/`）与 JSON import
 * 断言的组合。读同一个文件，因此不存在第二事实源。
 */
function profileHasServer(profileId: string): boolean {
  const contractPath = path.join(process.cwd(), "ui-profiles.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf-8")) as {
    default_profile?: string;
    profiles?: Record<string, { server?: boolean }>;
  };
  const active = profileId || contract.default_profile || "workbench";
  const entry = contract.profiles?.[active];
  if (!entry) {
    throw new Error(
      `未知的 UI 档案 ${JSON.stringify(active)}；` +
        `可选：${Object.keys(contract.profiles ?? {}).sort().join("、")}`,
    );
  }
  // 缺省 false（保守方向）：漏写时退化成"没有服务端"，而不是凭空获得写能力。
  return entry.server === true;
}

const hasServer = profileHasServer(process.env.NEXT_PUBLIC_UI_PROFILE ?? "");

const nextConfig: NextConfig = {
  // 有服务端 → 默认构建；无服务端 → 纯静态导出。
  ...(hasServer ? {} : { output: "export" as const }),
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  // 静态导出没有服务端，按需图片优化不可能实现；服务端构建下本项目也没有
  // 图片资源，故两种形态下都关掉，省去一处分支。
  images: { unoptimized: true },
};

export default nextConfig;
