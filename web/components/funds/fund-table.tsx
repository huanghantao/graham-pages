"use client";

/**
 * 一类基金的评分榜。
 *
 * ## 一个类别一张表，绝不合并
 *
 * 基金的业绩指标**不能跨类别绝对值比较** —— 一只纯债基金年化 5% 是优秀，
 * 一只偏股基金年化 5% 是平庸。因此每个因子都在**同类内**做百分位归一，
 * 分数表达的是"在同类中处于什么位置"。
 *
 * 这也意味着**分数只在本表内可比**：纯债榜首 97 分不等于它比偏股榜首 92 分更好，
 * 两者都只是"各自类别里最强的那一批"。
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmt, fmtInt } from "@/lib/format";
import type { FundFactorSpec, FundGroup } from "@/lib/types";

import { CoverageNote, FactorRow } from "./factor-bar";

type SortKey = "rank" | "size" | "age";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "rank", label: "同类排名" },
  { key: "age", label: "成立年限" },
  { key: "size", label: "规模" },
];

export function FundTable({
  group,
  factors,
}: {
  group: FundGroup;
  factors: FundFactorSpec[];
}) {
  const [sort, setSort] = useState<SortKey>("rank");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);

  // 只显示对该类别有意义的因子（纯债不显示持仓因子）
  const categoryFactors = useMemo(
    () => factors.filter((f) => f.categories.length === 0 || f.categories.includes(group.category)),
    [factors, group.category],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? group.rows.filter((r) => `${r.code} ${r.name}`.toLowerCase().includes(needle))
      : group.rows;
    if (sort === "rank") return filtered;
    return [...filtered].sort((a, b) =>
      sort === "size" ? (b.size ?? 0) - (a.size ?? 0) : b.age_years - a.age_years,
    );
  }, [group.rows, query, sort]);

  return (
    <Card>
      <CardHeader
        title={group.label}
        hint={`${fmtInt(group.count)} 只 · 本页 ${fmtInt(Math.min(limit, rows.length))}`}
      />
      <CardBody className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="过滤代码或名称…"
            className="w-full max-w-[14rem] rounded-lg border border-line/70 bg-surface px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-fg-subtle focus:border-line-strong"
          />
          <div className="flex items-center gap-0.5 rounded-lg border border-line/70 p-0.5">
            {SORTS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSort(option.key)}
                className={cn(
                  "rounded-[7px] px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  sort === option.key
                    ? "bg-bg-elevated text-fg shadow-card"
                    : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="divide-y divide-line/50">
          {rows.slice(0, limit).map((row) => {
            const byKey = new Map(row.factors.map((f) => [f.key, f]));
            const na = new Map(row.not_applicable.map((item) => [item.key, item.reason]));
            return (
              <li key={row.code} className="py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 items-baseline gap-2.5">
                    <span className="num w-12 shrink-0 text-[11px] text-fg-subtle">
                      {row.rank === null ? "—" : `#${row.rank}`}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium">
                        <Link
                          href={`/funds/${row.code}`}
                          className="underline decoration-dotted underline-offset-2 hover:text-accent"
                        >
                          {row.name}
                        </Link>
                      </div>
                      <div className="num mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-fg-subtle">
                        <span>{row.code}</span>
                        <span>· 成立 {row.age_years.toFixed(1)} 年</span>
                        <span>
                          · 规模{" "}
                          {row.size === null ? "—" : `${(row.size / 1e8).toFixed(1)} 亿`}
                        </span>
                        {row.context.holders.institutional_ratio !== null ? (
                          <span
                            style={{
                              color: row.context.holders.has_concentrated_risk
                                ? "var(--warn)"
                                : undefined,
                            }}
                            title={
                              row.context.holders.disclosure_note +
                              "。单一投资者持有达到或超过 20% 时，监管要求基金在定期报告中披露其类别、占比与变化情况 —— 越过这条线意味着监管本身已认为它影响投资决策。"
                            }
                          >
                            · 机构 {row.context.holders.institutional_ratio.toFixed(0)}%
                            {row.context.holders.holder_count !== null
                              ? ` / ${fmtInt(row.context.holders.holder_count)} 户`
                              : ""}
                          </span>
                        ) : null}
                        {row.context.smoothness ? (
                          <span
                            title="近 5 年最差年度收益 —— 业绩的下限"
                            style={{
                              color:
                                row.context.smoothness.worst < 0
                                  ? "var(--warn)"
                                  : undefined,
                            }}
                          >
                            · 最差年度 {fmt(row.context.smoothness.worst)}%
                          </span>
                        ) : null}
                        {row.context.top10_weight !== null ? (
                          <span>· 前十占净值 {row.context.top10_weight.toFixed(0)}%</span>
                        ) : null}
                        {row.share_members.length > 0 ? (
                          <span
                            className="text-accent/85"
                            title={`同一策略的其它份额已被合并到本行：${row.share_members.join("、")}。它们持仓完全相同、只是费率结构不同，因此只保留规模最大的份额作代表。`}
                          >
                            · 另含 {row.share_members.length} 个份额
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <CoverageNote coverage={row.coverage} />
                    <span
                      className="num text-[19px] font-semibold leading-none"
                      style={{
                        color:
                          row.score === null
                            ? "var(--fg-subtle)"
                            : row.score >= 70
                              ? "var(--pass)"
                              : row.score >= 45
                                ? "var(--accent)"
                                : "var(--warn)",
                      }}
                      title={
                        row.score === null
                          ? "可得因子权重不足，不输出综合分"
                          : `同类第 ${row.rank} / ${row.peer_count} 名` +
                            (row.universe_size &&
                            row.universe_size > row.peer_count
                              ? `（本类候选 ${row.universe_size} 只，含同一策略的其它份额；榜单每个策略只留规模最大的一个份额）`
                              : "")
                      }
                    >
                      {row.score === null ? "—" : fmt(row.score)}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5 pl-14 sm:grid-cols-3 lg:grid-cols-5">
                  {categoryFactors.map((spec) => (
                    <FactorRow
                      key={spec.key}
                      spec={spec}
                      score={byKey.get(spec.key)}
                      missing={row.missing.includes(spec.key)}
                      notApplicable={na.get(spec.key) ?? ""}
                    />
                  ))}
                </div>

                {row.score === null && row.notes.length > 0 ? (
                  <p className="mt-2 pl-14 text-[10.5px] leading-4 text-warn/90">
                    {row.notes[0]}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>

        {rows.length > limit ? (
          <button
            type="button"
            onClick={() => setLimit((value) => value + 50)}
            className="w-full rounded-lg border border-line/70 py-2 text-[12px] text-fg-muted transition-colors hover:bg-surface"
          >
            显示更多（还有 {fmtInt(rows.length - limit)} 只）
          </button>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** 因子权重与说明（模型口径披露）。 */
export function FactorLegend({ factors }: { factors: FundFactorSpec[] }) {
  const [open, setOpen] = useState(false);
  const total = factors.reduce((sum, f) => sum + f.weight, 0);

  return (
    <Card>
      <CardHeader
        title="评分模型"
        hint={`${factors.length} 个因子 · 权重合计 ${(total * 100).toFixed(0)}%`}
        action={
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-[11.5px] text-accent underline decoration-dotted underline-offset-2"
          >
            {open ? "收起" : "展开说明"}
          </button>
        }
      />
      <CardBody className="pt-4">
        <div className="flex flex-wrap gap-1.5">
          {factors.map((spec) => (
            <Badge key={spec.key} tone={spec.direction === "lower_better" ? "warn" : "neutral"}>
              {spec.label} {(spec.weight * 100).toFixed(0)}%
            </Badge>
          ))}
        </div>
        {open ? (
          <dl className="mt-4 space-y-2.5 border-t border-line/70 pt-3">
            {factors.map((spec) => (
              <div key={spec.key}>
                <dt className="flex flex-wrap items-baseline gap-2 text-[12px] font-medium">
                  {spec.label}
                  <span className="num text-[10.5px] font-normal text-fg-subtle">
                    权重 {(spec.weight * 100).toFixed(0)}% ·
                    {spec.direction === "lower_better" ? " 越小越好" : " 越大越好"}
                    {spec.min_age_years > 0 ? ` · 需成立满 ${spec.min_age_years} 年` : ""}
                    {spec.categories.length > 0
                      ? ` · 仅 ${spec.categories.map(categoryLabel).join("/")}`
                      : " · 全部类别"}
                  </span>
                </dt>
                <dd className="mt-0.5 text-[11px] leading-4.5 text-fg-muted">
                  {spec.description}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </CardBody>
    </Card>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  equity_hybrid: "偏股混合",
  bond_hybrid: "偏债混合",
  pure_bond_medium: "中长期纯债",
  pure_bond_short: "短期纯债",
};

function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key;
}
