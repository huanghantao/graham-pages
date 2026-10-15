/**
 * 快照读取层 —— 静态站点的**唯一**数据来源。
 *
 * 数据在构建期就已确定
 * --------------------
 * 本站读一份随仓库发布的快照，页面在构建时一次性渲染成 HTML。于是整个站点
 * 等价于一个纯函数 `站点 = f(一份快照)` —— 把 `f` 在**构建时**跑完，
 * 产物就是静态文件，运行时不依赖任何在线服务。
 *
 * 为什么读 `public/data`
 * ----------------------
 * 每次读取都发生在构建期（服务端组件），因此用 `fs` 直接读文件即可，
 * 无需起服务、无需网络。目录同时被 Next 拷进产物，于是**原始快照也能被
 * 下载** —— 对一个主张"每个数字都可溯源"的项目来说，这是特性而不是浪费。
 *
 * 缺失数据时返回 `null`，由页面渲染"没有数据"的引导文案，而不是让整页 500。
 */

import fs from "node:fs";
import path from "node:path";

import type {
  DataStatus,
  DataHealth,
  CriterionSpec,
  EtfRow,
  FundDetail,
  FundListResponse,
  Manifest,
  QueryContract,
  ScreenerSnapshot,
  RunInfo,
  SearchIndex,
  ThermometerReading,
  StockDetail,
  StrategyHit,
  StrategySummary,
} from "./types";

/**
 * 快照目录。
 *
 * 默认在 `public/data`（`graham publish --out web/public/data` 的产物）。
 * 允许用环境变量覆盖，是为了让"预览另一份快照"（例如对比两个快照日）不必
 * 改动仓库内容。
 */
const SNAPSHOT_DIR =
  process.env.GRAHAM_SNAPSHOT_DIR ?? path.join(process.cwd(), "public", "data");

/** 读一个快照文件；不存在或损坏时返回 `null`。 */
function readSnapshot<T>(relative: string): T | null {
  const target = path.join(SNAPSHOT_DIR, relative);
  try {
    return JSON.parse(fs.readFileSync(target, "utf-8")) as T;
  } catch (error) {
    // ENOENT 是**正常状态**：仓库刚克隆、还没跑过 publish。此时各页面显示
    // "尚无数据"引导即可，不该让构建失败。
    //
    // 但其它错误（JSON 语法错、权限问题）必须打出来 —— 静默吞掉会让构建
    // 出一个"能打开但处处空白"的站点，而排查时看不到任何线索。
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.error(`[snapshot] 读取 ${relative} 失败`, error);
    }
    return null;
  }
}

/** 列出快照里某个子目录下的全部标识（用于 generateStaticParams）。 */
function listSnapshotIds(subdir: string, extension = ".json"): string[] {
  const target = path.join(SNAPSHOT_DIR, subdir);
  try {
    return fs
      .readdirSync(target)
      .filter((name) => name.endsWith(extension))
      .map((name) => name.slice(0, -extension.length))
      .sort();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.error(`[snapshot] 读取目录 ${subdir} 失败`, error);
    }
    return [];
  }
}

// ── 元信息 ──────────────────────────────────────────────────────────────

/**
 * 读取快照 manifest。
 *
 * 站点上一切"这份数据是什么、什么时候的、收录了多少"的说明都取自它，
 * 而不是在页面里另写一份 —— 两处各写一份必然分叉。
 */
export function getManifest(): Manifest | null {
  return readSnapshot<Manifest>("manifest.json");
}

/** 快照的全部标的数据源（`generateStaticParams` 用）。 */
export function listStockCodes(): string[] {
  return listSnapshotIds("stocks");
}

/** 快照的全部基金代码（`generateStaticParams` 用）。 */
export function listFundCodes(): string[] {
  return listSnapshotIds("funds");
}

// ── 首页 ────────────────────────────────────────────────────────────────

export function getThermometer(): ThermometerReading | null {
  return readSnapshot<ThermometerReading>("thermometer.json");
}

// ── 个股 ────────────────────────────────────────────────────────────────

/**
 * 筛选器榜单快照。
 *
 * 与旧版 `getScreenUniverse` 的区别：旧版要在浏览器侧**按市场分别拉取再合并**
 * （因为全局 top-N 会让港股淹没 A 股）；静态站点上这件事已经在
 * `graham publish` 里做完了，因此这里退化成一次读取。
 */
export function getScreen(): ScreenerSnapshot | null {
  return readSnapshot<ScreenerSnapshot>("screen.json");
}

export function getStock(code: string): StockDetail | null {
  // 代码里可能有 `.` 与 `-`，但不含路径分隔符；显式拒绝 `..` 之类的穿越，
  // 避免把"读快照"变成"读任意文件"。
  if (!isSafeId(code)) return null;
  return readSnapshot<StockDetail>(`stocks/${code}.json`);
}

// ── 基金 ────────────────────────────────────────────────────────────────

export function getFunds(): FundListResponse | null {
  return readSnapshot<FundListResponse>("funds-index.json");
}

export function getFundDetail(code: string): FundDetail | null {
  if (!isSafeId(code)) return null;
  return readSnapshot<FundDetail>(`funds/${code}.json`);
}

export function getEtfs(): { rows: EtfRow[] } | null {
  return readSnapshot<{ rows: EtfRow[] }>("etfs.json");
}

// ── 方法论与健康 ────────────────────────────────────────────────────────

export function getDataHealth(): DataHealth | null {
  return readSnapshot<DataHealth>("health.json");
}

// ── ⌘K 搜索 ─────────────────────────────────────────────────────────────

/**
 * 搜索索引（随站点发布的静态文件）。
 *
 * 静态站点没有后端可查，因此索引在构建期就固化下来。它**只覆盖已发布的
 * 标的** —— 搜不到时面板必须说清这个边界，而不是让人以为"搜索坏了"。
 * 这与后端 `UnmatchedCode` 是同一个主张：把边界说出来。
 */
export function getSearchIndex(): SearchIndex | null {
  return readSnapshot<SearchIndex>("search-index.json");
}

/**
 * 判断一个代码是否有可链接的详情页。
 *
 * 用于"孤儿链接"降级：策略命中与基金持仓里会大量出现未发布的标的
 * （实测"经典防御组合"609 条命中里只有 56 条在发布范围内）。
 * 这些行必须渲染成**纯文本**而不是 404 链接。
 */
export function getPublishedCodes(): Set<string> {
  const index = getSearchIndex();
  return new Set((index?.entries ?? []).map((entry) => entry.code));
}

/**
 * 判断标识是否可安全用于拼接路径。
 *
 * 快照目录里的文件名来自标的代码，而代码最终会被拼进文件路径。虽然当前
 * 调用方传的都是站内数据，但把"读快照"变成"读任意文件"只需要一个
 * `../../` —— 拒绝比信任便宜。
 */
function isSafeId(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value) && !value.includes("..");
}

// ── 策略与方法论（仅工作台档案发布的产物）──────────────────────────────
//
// ★ 下面这组 reader 读的是 `strategies.json` / `methodology.json` /
//   `contracts.json` —— 公开档案把三者都扣留了（见 `ui-profiles.json`）。
//   因此**调用它们之前必须先确认能力存在**（`lib/route-guard.ts`），
//   否则读到的是空数组而不是"没有这一页"：页面会渲染出一个空榜，
//   而空榜看起来像"今天没有命中"，那是一种静默的错。

/** 策略清单与命中（快照里合成一个文件，省掉一轮读取）。 */
function readStrategies(): {
  strategies: StrategySummary[];
  status: DataStatus | null;
  detail: Map<string, { hits: StrategyHit[]; run: RunInfo | null }>;
} {
  const payload = readSnapshot<{
    strategies?: StrategySummary[];
    detail?: { strategy_id: string; run: RunInfo | null; hits: StrategyHit[] }[];
    status?: DataStatus;
  }>("strategies.json");

  const detail = new Map<string, { hits: StrategyHit[]; run: RunInfo | null }>();
  for (const item of payload?.detail ?? []) {
    detail.set(item.strategy_id, { hits: item.hits ?? [], run: item.run ?? null });
  }
  return {
    strategies: payload?.strategies ?? [],
    status: payload?.status ?? null,
    detail,
  };
}

export function getStrategies(): {
  strategies: StrategySummary[];
  status: DataStatus | null;
} {
  const { strategies, status } = readStrategies();
  return { strategies, status };
}

export function getStrategyHits(strategyId: string): {
  hits: StrategyHit[];
  run: RunInfo | null;
  status: DataStatus | null;
} {
  const { detail, status } = readStrategies();
  const entry = detail.get(strategyId);
  return { hits: entry?.hits ?? [], run: entry?.run ?? null, status };
}

/** 快照里真实存在的策略标识（`generateStaticParams` 用）。 */
export function listStrategyIds(): string[] {
  return readStrategies()
    .strategies.map((item) => item.strategy_id)
    .sort();
}

export function getMethodology(): CriterionSpec[] {
  return readSnapshot<{ criteria: CriterionSpec[] }>("methodology.json")?.criteria ?? [];
}

export function getContracts(): QueryContract[] {
  return readSnapshot<{ contracts: QueryContract[] }>("contracts.json")?.contracts ?? [];
}
