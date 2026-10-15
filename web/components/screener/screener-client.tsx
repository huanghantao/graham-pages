"use client";

/**
 * 筛选器（客户端即时筛选）。
 *
 * 四个体验决定
 * ------------
 * 1. **本地筛选 = 零延迟**：拉一页到客户端，拖动滑块即时出结果。
 * 2. **每个分数带视觉通道**：一屏几十行纯数字无法扫读（见 ScoreCell）。
 * 3. **如实暴露结果构成**：象限分布与行业集中度都显示 ——
 *    实测 MOS≥80 的标的中 39% 是银行，用户必须知道，否则会把
 *    "银行板块的低估值"误当成"全市场机会"。
 * 4. **移动端用卡片而非表格**：本表 8 列，横向滚动会让"比较两只股票"
 *    变成反复左右拖动 —— 而比较正是这个页面的全部意义。
 */

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  Badge,
  BottomSheet,
  Card,
  CoverageDots,
  DeltaCell,
  EmptyState,
  FloatingFilterButton,
  ScoreCell,
} from "@/components/ui";
import { compareText, fmt, fmtInt } from "@/lib/format";
import type { MarketInfo, Quadrant, RunInfo, ScoreRow } from "@/lib/types";

import {
  FilterPanel,
  MOMENTUM_OPTIONS,
  QUADRANT_META,
  type FilterValues,
  type MomentumKey,
} from "./filters";
import { ResultCards } from "./row-cards";
import { ProgressiveList } from "@/components/ui/progressive-list";
import { TurnoverCell } from "./turnover-cell";

/** 金融行业关键词 —— 用于计算行业集中度提示。 */
const FINANCIAL_KEYS = ["银行", "保险", "证券", "信托", "金融", "租赁"];

/** 动量分桶阈值（近 1 年涨跌幅，%）。 */
const MOMENTUM_RULES: Record<Exclude<MomentumKey, "all">, (value: number | null) => boolean> = {
  discovered: (value) => value !== null && value > 30,
  undiscovered: (value) => value !== null && value >= -15 && value <= 15,
  falling: (value) => value !== null && value < -30,
};

const DEFAULTS: FilterValues = {
  query: "",
  minMos: 0,
  minQuality: 0,
  quadrant: null,
  market: null,
  industry: null,
  momentum: "all",
  minTurnover: 0,
  orderBy: "mos",
};

/** **万** → 原始金额。筛选器用「万」是因为用户思考的单位就是它。 */
const WAN = 1e4;

/** 币种 → 展示标签。 */
const CURRENCY_LABEL: Record<string, string> = { cny: "CNY", hkd: "HKD", unknown: "" };

export function ScreenerClient({
  rows,
  returned,
  total,
  run,
  markets,
  publishedNote,
}: {
  rows: ScoreRow[];
  /** 本站实际收录的条数（= `rows.length`，由服务端显式传入以免两处不一致）。 */
  returned: number;
  /** 快照中全市场的真实总量 —— 与 `returned` 不是一回事。 */
  total: number;
  run: RunInfo | null;
  markets: MarketInfo[];
  /** 收录范围说明，展示在列表上方。 */
  publishedNote: string;
}) {
  const [values, setValues] = useState<FilterValues>(DEFAULTS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAllIndustries, setShowAllIndustries] = useState(false);

  const deferredQuery = useDeferredValue(values.query);

  //: 筛选条件的签名。变化时重置渐进加载的展开进度 ——
  //: 否则改完条件会停在"上一次的第 200 条"，看到的不是新结果的开头。
  const resetSignature = JSON.stringify(values);

  const patch = (next: Partial<FilterValues>) => setValues((prev) => ({ ...prev, ...next }));

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const rule = values.momentum === "all" ? null : MOMENTUM_RULES[values.momentum];

    const result = rows.filter((row) => {
      if (row.mos === null) {
        if (values.minMos > 0) return false;
      } else if (row.mos < values.minMos) return false;

      if (row.quality !== null && row.quality < values.minQuality) return false;
      if (values.quadrant && row.quadrant !== values.quadrant) return false;
      if (values.market && row.market !== values.market) return false;
      if (values.industry && row.industry !== values.industry) return false;
      // 流动性过滤：无成交数据的标的在启用该条件时被排除 ——
      // "不知道流动性"不能当成"流动性没问题"。
      if (values.minTurnover > 0) {
        const turnover = row.avg_turnover_20d;
        if (turnover === null || turnover < values.minTurnover * WAN) return false;
      }
      // 动量筛选：无价格数据的标的在启用该条件时被排除
      if (rule && !rule(row.price_change_1y)) return false;
      if (needle && !`${row.code} ${row.name}`.toLowerCase().includes(needle)) return false;
      return true;
    });

    return result.sort((a, b) => {
      const av = a[values.orderBy] as number | null;
      const bv = b[values.orderBy] as number | null;
      // null 永远排最后 —— "没有数据"不等于"最好"。与后端排序语义一致。
      if (av === null && bv === null) return compareText(a.code, b.code);
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av === bv) return compareText(a.code, b.code);
      return bv - av;
    });
  }, [rows, values, deferredQuery]);

  // 桌面表格的渐进加载。
  //
  // 为什么不复用 ProgressiveList 组件：它的"显示更多"按钮是块级元素，
  // 而这里按钮必须作为 `<tbody>` 里的一行（`<div>`/`<button>` 直接放在
  // `tbody` 下是非法 HTML，浏览器会把它移出去，导致表格结构被破坏）。
  // 因此表格用自己的状态，逻辑与 ProgressiveList 保持一致：
  // 首屏 40、每次 +40、改条件时重置。
  const [tableLimit, setTableLimit] = useState(40);
  useEffect(() => setTableLimit(40), [resetSignature]);
  const tableRows = useMemo(
    () => filtered.slice(0, tableLimit),
    [filtered, tableLimit],
  );
  const tableRemaining = Math.max(0, filtered.length - tableRows.length);

  const quadrantCounts = useMemo(() => {
    const counts = new Map<Quadrant, number>();
    for (const row of filtered) counts.set(row.quadrant, (counts.get(row.quadrant) ?? 0) + 1);
    return counts;
  }, [filtered]);

  /**
   * 行业计数 —— **按当前市场过滤**。
   *
   * 必须这样做：A 股用一级行业分类（29 类），港股用恒生行业三级（99 类），
   * 两套分类体系完全不对齐。混在一起会让用户看到上百个互相冲突的选项，
   * 而且选中一个 A 股行业会同时筛掉所有港股 —— 违反直觉。
   */
  const industryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.industry) continue;
      if (values.market && row.market !== values.market) continue;
      counts.set(row.industry, (counts.get(row.industry) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]));
  }, [rows, values.market]);

  /** 各市场的命中数（随其他条件联动的计数）。 */
  const marketCounts = useMemo(
    () =>
      markets.map((item) => ({
        ...item,
        count: filtered.filter((row) => row.market === item.market).length,
      })),
    [markets, filtered],
  );

  /** 行业集中度：金融类占比过高时如实告知。 */
  const concentration = useMemo(() => {
    if (filtered.length < 8) return null;
    const financial = filtered.filter(
      (row) => row.industry && FINANCIAL_KEYS.some((key) => row.industry!.includes(key)),
    ).length;
    const ratio = financial / filtered.length;
    return ratio >= 0.3 ? { financial, ratio } : null;
  }, [filtered]);

  const activeCount =
    (values.minMos > 0 ? 1 : 0) +
    (values.minQuality > 0 ? 1 : 0) +
    (values.quadrant ? 1 : 0) +
    (values.market ? 1 : 0) +
    (values.industry ? 1 : 0) +
    (values.minTurnover > 0 ? 1 : 0) +
    (values.momentum !== "all" ? 1 : 0) +
    (values.query.trim() ? 1 : 0);

  /** 已启用的条件标签 —— 让用户随时知道自己在看什么子集。 */
  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (values.minMos > 0)
      chips.push({ label: `安全边际 ≥ ${values.minMos}`, clear: () => patch({ minMos: 0 }) });
    if (values.minQuality > 0)
      chips.push({ label: `质量度 ≥ ${values.minQuality}`, clear: () => patch({ minQuality: 0 }) });
    if (values.quadrant)
      chips.push({
        label: QUADRANT_META[values.quadrant].label,
        clear: () => patch({ quadrant: null }),
      });
    if (values.market) {
      const item = markets.find((m) => m.market === values.market);
      chips.push({
        label: `${item?.label ?? values.market}${item ? ` · ${item.currency}` : ""}`,
        clear: () => patch({ market: null, industry: null }),
      });
    }
    if (values.industry) chips.push({ label: values.industry, clear: () => patch({ industry: null }) });
    if (values.minTurnover > 0)
      chips.push({
        label: `日均成交额 ≥ ${values.minTurnover} 万`,
        clear: () => patch({ minTurnover: 0 }),
      });
    if (values.momentum !== "all") {
      const option = MOMENTUM_OPTIONS.find((o) => o.value === values.momentum);
      chips.push({
        label: option?.label ?? values.momentum,
        clear: () => patch({ momentum: "all" }),
      });
    }
    if (values.query.trim())
      chips.push({ label: `“${values.query.trim()}”`, clear: () => patch({ query: "" }) });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const panel = (
    <FilterPanel
      values={values}
      onChange={patch}
      quadrantCounts={quadrantCounts}
      industryCounts={industryCounts}
      marketCounts={marketCounts}
      resultCount={filtered.length}
      showAllIndustries={showAllIndustries}
      onToggleIndustries={() => setShowAllIndustries((previous) => !previous)}
    />
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* ── 桌面侧栏（移动端隐藏，改由底部抽屉承担）────────────── */}
      <aside className="hidden lg:sticky lg:top-[74px] lg:block lg:self-start">
        <Card>
          <div className="flex items-center justify-between p-5 pb-3">
            <span className="text-[15px] font-semibold tracking-tight">筛选</span>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={() => setValues(DEFAULTS)}
                className="text-[11.5px] text-accent underline decoration-dotted underline-offset-2"
              >
                重置 {activeCount}
              </button>
            ) : null}
          </div>
          <div className="px-5 pb-5">{panel}</div>
        </Card>
      </aside>

      {/* ── 移动端抽屉 ─────────────────────────────────────────── */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="筛选条件"
        footer={
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setValues(DEFAULTS)}
              className="text-[13px] text-fg-muted underline decoration-dotted underline-offset-2"
            >
              重置全部
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white"
            >
              查看 {fmtInt(filtered.length)} 条结果
            </button>
          </div>
        }
      >
        {panel}
      </BottomSheet>

      {/* ── 结果 ──────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[20px] font-semibold tracking-tight">个股</h1>
            <span className="num text-[13px] text-fg-subtle">
              {fmtInt(filtered.length)}
              {activeCount > 0 ? ` / ${fmtInt(rows.length)}` : ""} 条
            </span>
          </div>
          {run ? (
            <span className="num text-[11.5px] text-fg-subtle">
              快照 {run.as_of} · 本站收录 {fmtInt(returned)} 只
            </span>
          ) : null}
        </div>

        {/* 生效条件标签 */}
        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.clear}
                className="group inline-flex items-center gap-1.5 rounded-md border border-line-strong/60 bg-surface px-2 py-1 text-[11.5px] text-fg-muted transition-colors hover:text-fg"
                title="点击移除该条件"
              >
                {chip.label}
                <span aria-hidden className="text-fg-subtle group-hover:text-fail">
                  ×
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setValues(DEFAULTS)}
              className="text-[11.5px] text-fg-subtle underline decoration-dotted underline-offset-2 hover:text-fg-muted"
            >
              清除全部
            </button>
          </div>
        ) : null}

        {/* 集中度提示 */}
        {concentration ? (
          <div className="rounded-xl border border-warn/25 bg-warn-bg px-3.5 py-2.5 text-[12px] leading-5">
            <span className="font-medium text-warn">行业高度集中　</span>
            <span className="text-fg-muted">
              当前 {fmtInt(filtered.length)} 条中{" "}
              <strong className="text-fg">{(concentration.ratio * 100).toFixed(0)}%</strong>{" "}
              属于金融行业（{concentration.financial} 只）。银行天然低 PB、高 ROE
              且盈利稳定，因而容易占据低估值榜单 —— 这既可能是真实机会，
              也可能意味着结果只是“银行板块”而非全市场机会。
            </span>
          </div>
        ) : null}

        {/*
          ★ 收录范围必须显式说明。这个站点**不是**全市场镜像：
          只发布每个市场排名靠前的若干只。原先这里写的是
          「列表载入 N 条，全市场共 M 条 · 服务端接口每页最多 500 条」——
          那句在静态站上是彻底的误导：既没有"下一页"可以要，
          "全市场"也不是本站能给你的东西。
        */}
        {returned < total ? (
          <p className="text-[11.5px] leading-5 text-fg-subtle">
            {publishedNote}
            本站收录 <strong className="text-fg-muted">{fmtInt(returned)}</strong> 只，
            快照中全市场共 <strong className="text-fg-muted">{fmtInt(total)}</strong> 只 ——
            榜单、筛选与下方的行业选项都只作用于已收录的部分。
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              title="当前条件下没有标的命中"
              hint="放宽安全边际或质量度阈值，或清除象限、行业与动量过滤后重试。"
              action={
                activeCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setValues(DEFAULTS)}
                    className="rounded-xl border border-line/70 px-4 py-2 text-[13px] font-medium transition-colors hover:bg-surface-hover"
                  >
                    重置全部条件
                  </button>
                ) : null
              }
            />
          </Card>
        ) : (
          <>
            {/* 移动端：卡片（渐进加载 —— 268 条全渲染在手机上高 79,154px）*/}
            <ProgressiveList
              items={filtered}
              unit="条"
              resetKey={resetSignature}
              render={(visible) => <ResultCards rows={visible} />}
            />

            {/* 桌面：表格（同样渐进加载 —— 268 行全渲染有 25 屏）*/}
            <Card className="hidden overflow-hidden lg:block lg:[&>div]:overflow-visible">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[58rem] border-collapse">
                  <thead>
                    <tr className="border-b border-line/70">
                      <th className="micro px-4 py-2.5 text-left font-medium">标的</th>
                      <th className="micro px-3 py-2.5 text-right font-medium">安全边际</th>
                      <th className="micro px-3 py-2.5 text-right font-medium">便宜度</th>
                      <th className="micro px-3 py-2.5 text-right font-medium">质量度</th>
                      <th
                        className="micro px-3 py-2.5 text-right font-medium"
                        title="近 20 日日均成交额 —— 判断'便宜能否兑现'的前置条件"
                      >
                        日均成交额
                      </th>
                      <th className="micro px-3 py-2.5 text-right font-medium">1 日</th>
                      <th className="micro px-3 py-2.5 text-right font-medium">1 月</th>
                      <th className="micro px-3 py-2.5 text-right font-medium">1 年</th>
                      <th className="micro px-3 py-2.5 text-center font-medium">覆盖率</th>
                      <th className="micro px-4 py-2.5 text-left font-medium">象限</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => {
                      const meta = QUADRANT_META[row.quadrant];
                      return (
                        <tr
                          key={row.code}
                          className="group border-b border-line/40 transition-colors last:border-0 hover:bg-surface/70"
                        >
                          <td className="px-4 py-2">
                            <Link
                              href={`/stocks/${row.code}`}
                              className="text-[13.5px] font-medium underline decoration-dotted underline-offset-2 group-hover:text-accent"
                            >
                              {row.name}
                            </Link>
                            <span className="num ml-2 text-[11px] text-fg-subtle">{row.code}</span>
                            {row.market !== "a_share" ? (
                              <span className="num ml-1.5 rounded border border-line-strong/50 px-1 text-[10px] text-fg-subtle">
                                {CURRENCY_LABEL[row.currency] ?? ""}
                              </span>
                            ) : null}
                            {row.industry ? (
                              <span className="ml-2 hidden text-[11px] text-fg-subtle xl:inline">
                                {row.industry}
                              </span>
                            ) : null}
                            {row.penalty > 0 ? (
                              <span
                                className="ml-2 text-[10.5px] text-fail"
                                title="雷区扣分来自监管或财务异常信号"
                              >
                                扣 {fmt(row.penalty, 0)}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <ScoreCell
                              value={row.mos}
                              title={
                                row.mos === null
                                  ? "数据覆盖率不足，未输出总分"
                                  : `便宜度 ${fmt(row.cheapness)} · 质量度 ${fmt(row.quality)} · 扣分 ${row.penalty}`
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <ScoreCell
                              value={row.cheapness}
                              tone={row.cheapness === null ? "fail" : "neutral"}
                              title={
                                row.cheapness === null
                                  ? "亏损公司：盈利类估值不适用，符号守卫拒绝评分"
                                  : undefined
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <ScoreCell value={row.quality} tone="neutral" />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <TurnoverCell
                              value={row.avg_turnover_20d}
                              market={row.market}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <DeltaCell value={row.price_change_1d} showBar={false} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <DeltaCell value={row.price_change_1m} showBar={false} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <DeltaCell value={row.price_change_1y} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <CoverageDots value={row.coverage} />
                          </td>
                          <td className="px-4 py-2">
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {tableRemaining > 0 ? (
                      <tr className="border-t border-line/70">
                        <td colSpan={9} className="p-0">
                          <button
                            type="button"
                            onClick={() => setTableLimit((value) => value + 40)}
                            className="w-full py-2.5 text-[12.5px] text-fg-muted transition-colors hover:bg-surface"
                          >
                            显示更多（还有 {fmtInt(tableRemaining)} 条）
                          </button>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ── 移动端浮动筛选按钮 ─────────────────────────────────── */}
      <FloatingFilterButton count={activeCount} onClick={() => setSheetOpen(true)} />
    </div>
  );
}
