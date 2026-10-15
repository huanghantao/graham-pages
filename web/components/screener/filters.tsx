"use client";

/**
 * 筛选条件面板（桌面侧栏与移动抽屉共用同一份内容）。
 *
 * 抽出来复用的理由：两处若各写一份，条件选项很快就会不一致 ——
 * 而"手机上少一个过滤条件"是很难被发现的缺陷。
 */

import { Badge, Segmented } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";
import type { Quadrant } from "@/lib/types";

export const QUADRANT_META: Record<
  Quadrant,
  { label: string; tone: "pass" | "warn" | "accent" | "fail" | "neutral"; hint: string }
> = {
  cheap_good: {
    label: "便宜且好",
    tone: "pass",
    hint: "便宜度与质量度均达标 —— 安全边际的主要来源",
  },
  cheap_poor: {
    label: "便宜但差",
    tone: "warn",
    hint: "便宜但质量不足，或被雷区扣分降级 —— 价值陷阱最可能出现的位置",
  },
  rich_good: { label: "好但贵", tone: "accent", hint: "质量好但估值不便宜 —— 等待更好价格" },
  rich_poor: { label: "贵且差", tone: "fail", hint: "既不便宜质量也不足" },
  unscorable: {
    label: "无法评分",
    tone: "neutral",
    hint: "数据覆盖率不足，未输出总分",
  },
};

export const ORDER_OPTIONS = [
  { value: "mos", label: "安全边际" },
  { value: "cheapness", label: "便宜度" },
  { value: "quality", label: "质量度" },
  { value: "avg_turnover_20d", label: "日均成交额" },
  { value: "price_change_1y", label: "1 年涨幅" },
] as const;

/** 最小日均成交额选项（单位为**万**，与显示一致）。 */
export const TURNOVER_OPTIONS = [
  { value: 0, label: "不限", hint: "" },
  {
    value: 10,
    label: "≥ 10 万",
    hint: "剔除几乎无法交易的标的。实测港股中约 41% 的个股低于此线",
  },
  {
    value: 100,
    label: "≥ 100 万",
    hint: "可小规模建仓（10 万港元仓位约占当日成交 10%）。推荐的下限",
  },
  {
    value: 1000,
    label: "≥ 1000 万",
    hint: "流动性充裕，可容纳较大仓位",
  },
] as const;

export type OrderKey = (typeof ORDER_OPTIONS)[number]["value"];

/** 动量筛选：判断"便宜"是否已被市场发现。 */
export const MOMENTUM_OPTIONS = [
  { value: "all", label: "不限" },
  { value: "discovered", label: "已被发现", hint: "近 1 年涨幅 > 30% —— 市场已在重估" },
  { value: "undiscovered", label: "尚未启动", hint: "近 1 年涨幅在 ±15% 之内 —— 估值便宜但价格未动" },
  { value: "falling", label: "仍在下跌", hint: "近 1 年跌幅 > 30% —— 可能更深低估，也可能是陷阱" },
] as const;

export type MomentumKey = (typeof MOMENTUM_OPTIONS)[number]["value"];

export interface FilterValues {
  query: string;
  minMos: number;
  minQuality: number;
  quadrant: Quadrant | null;
  /** 市场过滤。`null` = 全部。
   *
   * 为什么必须有：港股与 A 股的**币种**（HKD vs CNY）、**行业分类体系**
   * （恒生三级 99 类 vs 一级 29 类）、**判据适用性**都不同。
   * 混在一张表里比较总市值或行业，会得出错误结论。
   */
  market: string | null;
  industry: string | null;
  momentum: MomentumKey;
  /** 最小日均成交额（**万**单位，如 100 = 100 万）。
   *
   * 为什么它比安全边际更重要：一只 P/NCAV 0.2 但日成交 1,690 港元的股票，
   * 折价来自无法建仓而非市场误定价。实测严格净网股中约 84% 的
   * 日均成交额低于 100 万港元 —— 不做这一步筛选，名单基本不可用。
   */
  minTurnover: number;
  orderBy: OrderKey;
}

export function Threshold({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="micro" title={hint}>
          {label}
        </span>
        <span className="num text-[12px] font-medium">{value === 0 ? "不限" : `≥ ${value}`}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface accent-[var(--accent)]"
      />
    </div>
  );
}

export function FilterPanel({
  values,
  onChange,
  quadrantCounts,
  industryCounts,
  marketCounts,
  resultCount,
  showAllIndustries,
  onToggleIndustries,
}: {
  values: FilterValues;
  onChange: (patch: Partial<FilterValues>) => void;
  quadrantCounts: Map<Quadrant, number>;
  /** **已按当前市场过滤**的行业计数 —— 行业分类体系随市场而变。 */
  industryCounts: [string, number][];
  marketCounts: { market: string; label: string; currency: string; count: number }[];
  resultCount: number;
  showAllIndustries: boolean;
  onToggleIndustries: () => void;
}) {
  const visibleIndustries = showAllIndustries ? industryCounts : industryCounts.slice(0, 10);

  return (
    <div className="space-y-5">
      <input
        value={values.query}
        onChange={(event) => onChange({ query: event.target.value })}
        placeholder="搜索代码或名称…"
        className="w-full rounded-lg border border-line/70 bg-surface px-3 py-2.5 text-[14px] outline-none transition-colors placeholder:text-fg-subtle focus:border-line-strong"
      />

      {/* 市场切换：切换市场时同时清空行业（两套分类体系不通用） */}
      {marketCounts.length > 1 ? (
        <div className="border-t border-line/70 pt-4">
          <span className="micro mb-2 block">市场</span>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => onChange({ market: null, industry: null })}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
                values.market === null ? "bg-surface text-fg" : "text-fg-muted hover:bg-surface/70",
              )}
            >
              <span>全部市场</span>
              <span className="num text-[11px] text-fg-subtle">{resultCount}</span>
            </button>
            {marketCounts.map((item) => (
              <button
                key={item.market}
                type="button"
                onClick={() => onChange({ market: item.market, industry: null })}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
                  values.market === item.market
                    ? "bg-surface text-fg"
                    : "text-fg-muted hover:bg-surface/70",
                )}
              >
                <span className="flex items-baseline gap-1.5">
                  {item.label}
                  <span className="num text-[10px] text-fg-subtle">{item.currency}</span>
                </span>
                <span className="num text-[11px] text-fg-subtle">{fmtInt(item.count)}</span>
              </button>
            ))}
          </div>
          {values.market ? (
            <p className="mt-2 text-[10.5px] leading-4 text-warn/80">
              币种 {marketCounts.find((m) => m.market === values.market)?.currency} ·
              行业分类为该市场体系，与另一市场不可比
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4 border-t border-line/70 pt-4">
        <Threshold
          label="安全边际"
          value={values.minMos}
          onChange={(minMos) => onChange({ minMos })}
          hint="便宜度与质量度各占 50%，再减雷区扣分"
        />
        <Threshold
          label="质量度"
          value={values.minQuality}
          onChange={(minQuality) => onChange({ minQuality })}
        />
      </div>

      {/* 流动性 —— 判断"便宜能否兑现"的前置条件 */}
      <div className="border-t border-line/70 pt-4">
        <span className="micro mb-2 block">日均成交额</span>
        <div className="space-y-0.5">
          {TURNOVER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ minTurnover: option.value })}
              title={option.hint}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
                values.minTurnover === option.value
                  ? "bg-surface text-fg"
                  : "text-fg-muted hover:bg-surface/70",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {values.minTurnover > 0 ? (
          <p className="mt-2 text-[10.5px] leading-4 text-warn/80">
            成交清淡的标的，其“折价”往往来自无法建仓而非市场误定价 ——
            买入会推动价格，卖出可能找不到对手方
          </p>
        ) : null}
      </div>

      <div className="border-t border-line/70 pt-4">
        <span className="micro mb-2 block">排序</span>
        <Segmented
          options={ORDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={values.orderBy}
          onChange={(next) => onChange({ orderBy: next as OrderKey })}
          size="sm"
          columns={2}
        />
      </div>

      {/* 动量筛选 —— 本页最有分析价值的一个维度 */}
      <div className="border-t border-line/70 pt-4">
        <span className="micro mb-2 block">价格动量</span>
        <div className="space-y-0.5">
          {MOMENTUM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ momentum: option.value })}
              title={"hint" in option ? option.hint : undefined}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
                values.momentum === option.value
                  ? "bg-surface text-fg"
                  : "text-fg-muted hover:bg-surface/70",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-line/70 pt-4">
        <span className="micro mb-2 block">象限</span>
        <div className="space-y-0.5">
          <Row
            active={values.quadrant === null}
            label="不限"
            count={resultCount}
            onClick={() => onChange({ quadrant: null })}
          />
          {(Object.keys(QUADRANT_META) as Quadrant[])
            .filter((key) => quadrantCounts.get(key) || values.quadrant === key)
            .map((key) => (
              <Row
                key={key}
                active={values.quadrant === key}
                label={QUADRANT_META[key].label}
                tone={QUADRANT_META[key].tone}
                count={quadrantCounts.get(key) ?? 0}
                hint={QUADRANT_META[key].hint}
                onClick={() =>
                  onChange({ quadrant: values.quadrant === key ? null : key })
                }
              />
            ))}
        </div>
      </div>

      {industryCounts.length > 0 ? (
        <div className="border-t border-line/70 pt-4">
          <span className="micro mb-2 block">行业（按命中数）</span>
          <div className="space-y-0.5">
            {visibleIndustries.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() =>
                  onChange({ industry: values.industry === name ? null : name })
                }
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-[12px] transition-colors",
                  values.industry === name
                    ? "bg-accent-bg text-accent"
                    : "text-fg-muted hover:bg-surface/70",
                )}
              >
                <span className="truncate">{name}</span>
                <span className="num shrink-0 text-[11px] text-fg-subtle">{count}</span>
              </button>
            ))}
          </div>
          {industryCounts.length > 10 ? (
            <button
              type="button"
              onClick={onToggleIndustries}
              className="mt-1.5 text-[11px] text-fg-subtle underline decoration-dotted underline-offset-2 hover:text-fg-muted"
            >
              {showAllIndustries ? "收起" : `展开全部 ${fmtInt(industryCounts.length)} 个行业`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  active,
  label,
  count,
  tone = "neutral",
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  tone?: "pass" | "warn" | "accent" | "fail" | "neutral";
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
        active ? "bg-surface text-fg" : "text-fg-muted hover:bg-surface/70",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        {tone !== "neutral" ? <Badge tone={tone}>{label}</Badge> : label}
      </span>
      <span className="num shrink-0 text-[11px] text-fg-subtle">{count}</span>
    </button>
  );
}
