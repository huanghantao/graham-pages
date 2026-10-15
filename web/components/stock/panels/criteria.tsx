"use client";

/**
 * 判据面板：回答"为什么得出这个结论"。
 *
 * 每条判据都是一行，点击展开出处、豁免依据与实测/阈值对比。
 * 展开式而非全部展开：默认视图紧凑（一行一条），需要复核时才展开。
 *
 * 「数据不足」与「未通过」在视觉上明确区分 —— 前者是数据问题，
 * 后者是公司问题，混为一谈会误导用户。
 */

import { useState } from "react";

import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DASH, fmt, fmtMoney } from "@/lib/format";
import type { CriterionOutcome, CriterionResult, StockDetail } from "@/lib/types";

/** 判据键 → 中文名（用于市场口径说明）。 */
const CRITERION_LABEL: Record<string, string> = {
  adequate_size: "规模充分",
  financial_condition: "财务稳健",
  earnings_stability: "盈利稳定",
  dividend_record: "股息记录",
  earnings_growth: "盈利增长",
  moderate_pe: "市盈率适度",
  moderate_pb: "市净率适度",
  net_current_asset: "净流动资产折价（Net-Net）",
};

const OUTCOME_META: Record<CriterionOutcome, { mark: string; tone: string; label: string }> = {
  pass: { mark: "✓", tone: "text-pass", label: "通过" },
  fail: { mark: "✗", tone: "text-fail", label: "未通过" },
  exempt: { mark: "–", tone: "text-muted-mark", label: "豁免" },
  insufficient_data: { mark: "?", tone: "text-warn", label: "数据不足" },
};

export function CriteriaPanel({ detail }: { detail: StockDetail }) {
  const criteria = detail.criteria;
  const profile = detail.market_profile;
  const currency = (profile?.currency ?? "CNY").toLowerCase();
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (!criteria) {
    return (
      <Card>
        <CardBody>
          <p className="text-[13px] text-fg-subtle">无判据评估结果</p>
        </CardBody>
      </Card>
    );
  }

  const counted = criteria.results.filter(
    (item) => item.outcome === "pass" || item.outcome === "fail",
  );

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Card className="lg:col-span-8">
        <CardHeader
          title="格雷厄姆防御型七条"
          hint={`${criteria.regime_label}口径 · 点击展开出处`}
          action={
            <div className="flex items-center gap-2">
              <Badge tone="pass">{criteria.passed} 通过</Badge>
              {criteria.failed > 0 ? <Badge tone="fail">{criteria.failed} 未通过</Badge> : null}
              {criteria.exempt > 0 ? <Badge tone="neutral">{criteria.exempt} 豁免</Badge> : null}
            </div>
          }
        />
        <CardBody className="pt-4">
          <ul className="divide-y divide-line/60">
            {criteria.results.map((item) => (
              <CriterionRow
                key={item.criterion}
                item={item}
                currency={currency}
                open={openKey === item.criterion}
                onToggle={() =>
                  setOpenKey((previous) => (previous === item.criterion ? null : item.criterion))
                }
              />
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="space-y-5 lg:col-span-4">
        <Card>
          <CardHeader title="统计口径" />
          <CardBody className="space-y-3 pt-4">
            <p className="text-[12.5px] leading-6 text-fg-muted">
              通过率的<strong className="text-fg">分母只计入可评分的判据</strong>
              （通过 + 未通过）。豁免与数据不足不计入 ——
              把“无法判断”当作“不满足”会系统性低估标的，
              把豁免当作“通过”则会高估，两者都不诚实。
            </p>
            <div className="flex items-baseline justify-between border-t border-line/70 pt-3">
              <span className="text-[12.5px] text-fg-muted">可评分判据</span>
              <span className="num text-[13px] font-medium">
                {counted.length} / {criteria.total}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] text-fg-muted">通过率</span>
              <span className="num text-[13px] font-medium">
                {(criteria.pass_ratio * 100).toFixed(0)}%
              </span>
            </div>
          </CardBody>
        </Card>

        {profile && (Object.keys(profile.unavailable_criteria).length > 0 ||
          Object.keys(profile.partial_criteria).length > 0) ? (
          <Card>
            <CardHeader
              title={`${profile.label}数据口径`}
              hint={`币种 ${profile.currency} · ${profile.metric_count} 项指标可用`}
            />
            <CardBody className="space-y-3 pt-4">
              <p className="text-[11.5px] leading-5 text-fg-subtle">
                以下差异来自市场制度与报告准则，<strong className="text-fg-muted">与公司好坏无关</strong>
                。本站如实标注，而不是把“取不到数据”显示成“没有问题”。
              </p>
              {Object.entries(profile.unavailable_criteria).map(([key, reason]) => (
                <div key={key} className="rounded-lg border border-line/70 bg-surface/60 p-2.5">
                  <p className="text-[11.5px] font-medium">
                    {CRITERION_LABEL[key] ?? key}
                    <span className="ml-1.5 rounded border border-fail/40 px-1 py-px text-[10px] text-fail">
                      不适用
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-fg-subtle">{reason}</p>
                </div>
              ))}
              {Object.entries(profile.partial_criteria).map(([key, reason]) => (
                <div key={key} className="rounded-lg border border-warn/25 bg-warn-bg p-2.5">
                  <p className="text-[11.5px] font-medium">
                    {CRITERION_LABEL[key] ?? key}
                    <span className="ml-1.5 rounded border border-warn/40 px-1 py-px text-[10px] text-warn">
                      部分适用
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-fg-muted">{reason}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        ) : null}

        {detail.methodology_notes.length > 0 ? (
          <Card>
            <CardHeader title="本次计算的方法论说明" />
            <CardBody className="pt-4">
              <ul className="space-y-2.5">
                {detail.methodology_notes.map((note, index) => (
                  <li key={index} className="flex gap-2 text-[12px] leading-5 text-fg-muted">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-warn opacity-70" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 按判据类型格式化实测值与阈值。
 *
 * 统一用 `fmt()` 会让金额显示成 14 位原始数字（如
 * `40,973,248,491.80 ≥ 2,000,000,000.00`），既难读又容易看错数量级。
 * 因此按判据语义选择单位：金额用「亿」、倍数保留两位、年数取整。
 */
function formatObserved(item: CriterionResult, currency?: string | null): string {
  const value = item.observed;
  if (value === null) return DASH;
  switch (item.criterion) {
    case "adequate_size":
      return fmtMoney(value, 1, currency);
    case "earnings_stability":
    case "dividend_record":
      return `${Math.round(value)} 年`;
    case "earnings_growth":
      // 比值：转成百分比增量更有意义（1.33 → +33%）
      return `${((value - 1) * 100).toFixed(1)}%`;
    default:
      return fmt(value);
  }
}

function formatThreshold(item: CriterionResult, currency?: string | null): string {
  const value = item.threshold;
  if (value === null) return DASH;
  switch (item.criterion) {
    case "adequate_size":
      return fmtMoney(value, 1, currency);
    case "earnings_stability":
    case "dividend_record":
      return `${Math.round(value)} 年`;
    case "earnings_growth":
      return `+${((value - 1) * 100).toFixed(0)}%`;
    default:
      return fmt(value);
  }
}

/**
 * 单条判据。
 *
 * 布局刻意做成**响应式两态**：
 *
 * * 桌面：单行「标记 · 标签 · 说明 · 实测/阈值」—— 信息密度高，适合扫读；
 * * 移动：**纵向堆叠**「标记+标签+徽标 / 说明 / 实测阈值」——
 *   三列横排在窄屏会把说明列挤到每行两三个字（实测如此），完全不可读。
 *
 * 另外，移动端**隐藏右侧的实测/阈值列**：``detail`` 文本本身已经包含了
 * 这两个数字（如「流动比率 1.29，低于门槛 1.50」），重复显示会占掉
 * 本就不够的宽度，还把说明挤成了竖排。
 */
function CriterionRow({
  item,
  currency,
  open,
  onToggle,
}: {
  item: CriterionResult;
  /** 币种（`cny` / `hkd`）—— 金额类判据必须按市场标注单位。 */
  currency?: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = OUTCOME_META[item.outcome];
  const hasDetail = Boolean(item.source || item.exemption || item.detail);
  const hasNumbers = item.observed !== null && item.threshold !== null;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasDetail}
        className={cn(
          "flex w-full flex-col gap-1 py-3 text-left transition-colors sm:flex-row sm:items-start sm:gap-3",
          hasDetail && "hover:bg-surface/50",
        )}
      >
        {/* 第一行：标记 + 标签 + 徽标（移动端）/ 三者与说明同行（桌面端） */}
        <span className="flex min-w-0 items-center gap-2 sm:contents">
          <span className={cn("num w-4 shrink-0 text-center text-[15px]", meta.tone)}>
            {meta.mark}
          </span>
          <span className="shrink-0 text-[13px] font-medium sm:w-[5.5rem]">
            {item.label}
          </span>
          {item.partial ? (
            <span
              className="shrink-0 rounded border border-warn/40 px-1 py-px text-[10px] text-warn"
              title="该判据在本市场仅部分适用 —— 展开可看缺口说明"
            >
              部分适用
            </span>
          ) : null}
        </span>

        <span className="min-w-0 flex-1 pl-6 text-[12.5px] leading-5 text-fg-muted sm:pl-0">
          {item.detail}
        </span>

        {hasNumbers ? (
          <span className="num hidden shrink-0 text-right text-[11px] text-fg-subtle sm:block">
            <span className="text-fg-muted">{formatObserved(item, currency)}</span>
            <span className="mx-1 opacity-60">{item.comparator}</span>
            {formatThreshold(item, currency)}
          </span>
        ) : (
          <span className="hidden shrink-0 text-[11px] text-fg-subtle sm:block">
            {meta.label}
          </span>
        )}

        {hasDetail ? (
          <span
            className={cn(
              "hidden shrink-0 text-[10px] text-fg-subtle transition-transform duration-200 sm:block",
              open && "rotate-90",
            )}
            aria-hidden
          >
            ›
          </span>
        ) : null}
      </button>

      {open && hasDetail ? (
        <div className="animate-rise mb-3 rounded-xl bg-surface px-3.5 py-3 sm:ml-7">
          {hasNumbers ? (
            <p className="num mb-2 text-[11.5px] text-fg-subtle sm:hidden">
              实测 {formatObserved(item, currency)} {item.comparator} 阈值{" "}
              {formatThreshold(item, currency)}
            </p>
          ) : null}
          {item.source ? (
            <p className="text-[11.5px] leading-5 text-fg-subtle">
              <span className="font-medium text-fg-muted">出处　</span>
              {item.source}
            </p>
          ) : null}
          {item.exemption ? (
            <>
              <p className="mt-2 text-[11.5px] leading-5 text-fg-subtle">
                <span className="font-medium text-fg-muted">豁免理由　</span>
                {item.exemption.reason}
              </p>
              <p className="mt-1 text-[11.5px] leading-5 text-warn">
                <span className="font-medium">豁免依据　</span>
                {item.exemption.source}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
