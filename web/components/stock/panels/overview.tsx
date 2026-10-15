"use client";

/**
 * 概览面板：回答"这家公司值不值得继续看"。
 *
 * 内容顺序即阅读优先级：
 * 1. 关键指标（含符号状态）—— 一眼看清估值；
 * 2. 安全边际分解 —— 分数从哪来；
 * 3. 估值与资产 —— NCAV 双口径；
 * 4. 雷区摘要 —— 有无致命问题。
 */

import { MiniBars } from "@/components/charts";
import { cn } from "@/lib/cn";
import { Badge, Card, CardBody, CardHeader, Notice, Stat, Tip } from "@/components/ui";
import { KeyMetrics } from "@/components/stock/key-metrics";

import { NcavComposition } from "./ncav-composition";
import { DASH, fmt, fmtInt, fmtRatio } from "@/lib/format";
import type { StockDetail } from "@/lib/types";

/**
 * 严重级 → 徽标文案与配色。
 *
 * ``info`` 必须与 ``medium`` 区分开：前者是"客观属性、不参与扣分"
 * （如港股 GEM 板块），后者是"需要留意的负面证据"。
 * 早期实现只用三元表达式区分三档，``info`` 会被显示成「中」——
 * 把中性属性说成负面证据，正是本项目一直在修的那类误标。
 */
interface SeverityMeta {
  label: string;
  tone: "fail" | "warn" | "neutral";
  border: string;
}

const SEVERITY_META: Record<string, SeverityMeta> = {
  critical: { label: "严重", tone: "fail", border: "border-fail/35 bg-fail-bg/40" },
  high: { label: "高", tone: "fail", border: "border-fail/25" },
  medium: { label: "中", tone: "warn", border: "border-warn/25 bg-warn-bg/40" },
  info: { label: "提示", tone: "neutral", border: "border-line/70" },
};

/** 未知严重级按「中」呈现（保守：不把未知当无害）。 */
function severityMeta(severity: string): SeverityMeta {
  return SEVERITY_META[severity] ?? { label: "中", tone: "warn", border: "border-warn/25" };
}

export function OverviewPanel({ detail }: { detail: StockDetail }) {
  const margin = detail.margin;
  const breakdown = margin?.breakdown ?? {};

  const cheapParts = Object.entries(breakdown)
    .filter(([key]) => key.startsWith("cheapness.") && !key.endsWith(".total"))
    .map(([key, value]) => ({ label: LABELS[key] ?? key.split(".")[1]!, value }));

  const qualityParts = Object.entries(breakdown)
    .filter(([key]) => key.startsWith("quality.") && !key.endsWith(".total"))
    .map(([key, value]) => ({ label: LABELS[key] ?? key.split(".")[1]!, value }));

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* 关键指标 */}
      <Card className="lg:col-span-7">
        <CardHeader
          title="关键指标"
          hint="「不适用」不等于「没有数据」"
          action={
            <span className="text-[11px] text-fg-subtle">
              悬停查看不适用原因
            </span>
          }
        />
        <CardBody className="pt-4">
          <KeyMetrics metrics={detail.key_metrics} />
        </CardBody>
      </Card>

      {/* 安全边际分解 */}
      <Card className="lg:col-span-5">
        <CardHeader title="安全边际分解" />
        <CardBody className="space-y-5 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="总分"
              value={margin?.mos == null ? DASH : fmt(margin.mos, 1)}
              size="md"
              tone={margin?.mos == null ? "neutral" : margin.mos >= 50 ? "pass" : "fail"}
            />
            <Stat
              label="扣分"
              value={margin && margin.penalty > 0 ? `−${fmt(margin.penalty, 1)}` : "0"}
              size="md"
              tone={margin && margin.penalty > 0 ? "fail" : "neutral"}
            />
            <Stat
              label="覆盖率"
              value={margin ? fmtRatio(margin.coverage) : DASH}
              size="md"
              tone={margin && margin.coverage < 0.6 ? "warn" : "neutral"}
            />
          </div>

          <div className="space-y-4 border-t border-line/70 pt-4">
            <div>
              <p className="micro mb-2.5">便宜度分项</p>
              {cheapParts.length > 0 ? (
                <MiniBars items={cheapParts} />
              ) : (
                <p className="text-[12px] text-fg-subtle">
                  不可用 —— 亏损公司的盈利类估值不适用（符号守卫硬闸门）
                </p>
              )}
            </div>
            <div>
              <p className="micro mb-2.5">质量度分项</p>
              {qualityParts.length > 0 ? (
                <MiniBars items={qualityParts} />
              ) : (
                <p className="text-[12px] text-fg-subtle">数据不足</p>
              )}
            </div>
          </div>

          {margin && margin.notes.length > 0 ? (
            <Notice tone="warn" title="评分说明">
              <ul className="space-y-1.5">
                {margin.notes.map((note, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-current opacity-50" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}
        </CardBody>
      </Card>

      {/* NCAV */}
      <Card className="lg:col-span-5">
        <CardHeader title="净流动资产（NCAV）" hint="两种口径并列" />
        <CardBody className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Tip content={detail.ncav.note}>
              <div>
                <Stat
                  label="严格口径"
                  value={detail.ncav.ncav_strict === null ? DASH : fmtMoneyShort(detail.ncav.ncav_strict)}
                  size="sm"
                  // 口径标签必须与**该市场实际使用的公式**一致：
                  // 港股取不到「优先股」科目，若这里照写「+ 优先股」，
                  // 就会与下方口径说明自相矛盾 —— 用户无法判断哪个是真的。
                  hint={
                    detail.ncav.caliber_note
                      ? "流动资产 − 总负债（未减优先股，详见下方说明）"
                      : "流动资产 −（总负债 + 优先股）"
                  }
                />
              </div>
            </Tip>
            <div>
              <Stat
                label="宽松口径"
                value={detail.ncav.ncav_loose === null ? DASH : fmtMoneyShort(detail.ncav.ncav_loose)}
                size="sm"
                hint="流动资产 − 流动负债"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-line/70 pt-4">
            <Stat label="总市值" value={fmtMoneyShort(detail.ncav.market_cap)} size="sm" />
            <Stat
              label="严格折价"
              value={fmtRatio(detail.ncav.discount_strict)}
              size="sm"
              tone={detail.ncav.discount_strict != null && detail.ncav.discount_strict > 0 ? "pass" : "neutral"}
            />
            <Stat label="宽松折价" value={fmtRatio(detail.ncav.discount_loose)} size="sm" />
          </div>

          {detail.ncav.unavailable_reason ? (
            <Notice tone="warn" title="NCAV 不适用">
              {detail.ncav.unavailable_reason}
            </Notice>
          ) : null}

          <p className="text-[11px] leading-5 text-fg-subtle">{detail.ncav.note}</p>
          <div className="border-t border-line/70 pt-4">
            <NcavComposition
              composition={detail.composition}
              currency={(detail.market_profile?.currency ?? "CNY").toLowerCase()}
            />
          </div>
          {/* 口径差异必须与数字放在一起 —— 港股严格口径不含优先股项，
              只看数字而不知道这一点会让跨市场比较出错。 */}
          {detail.ncav.caliber_note ? (
            <p className="mt-1.5 rounded-lg border border-warn/25 bg-warn-bg px-2.5 py-1.5 text-[11px] leading-5 text-fg-muted">
              {detail.ncav.caliber_note}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* 雷区摘要 */}
      <Card className="lg:col-span-7">
        <CardHeader
          title="雷区信号"
          hint={detail.risk_flags.length === 0 ? "未命中" : `${fmtInt(detail.risk_flags.length)} 项`}
        />
        <CardBody className="pt-4">
          {detail.risk_flags.length === 0 ? (
            <Notice>
              未命中监管或财务异常信号。
              <span className="mt-1 block text-fg-subtle">
                注意：这<strong className="text-fg-muted">不等于没有风险</strong>
                ，只表示已采集的信号未命中；部分信号本平台取不到（见「溯源」页）。
              </span>
            </Notice>
          ) : (
            <ul className="space-y-2.5">
              {detail.risk_flags.map((flag) => {
                const meta = severityMeta(flag.severity);
                return (
                  <li
                    key={flag.flag_code}
                    className={cn("rounded-xl border p-3.5", meta.border)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span className="text-[13.5px] font-medium">{flag.title}</span>
                      {flag.as_of ? (
                        <span className="num text-[11px] text-fg-subtle">截止 {flag.as_of}</span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[12px] leading-5 text-fg-muted">{flag.detail}</p>
                    {/* 证据是信号最有价值的部分：用户要看到「凭什么」，
                        而不只是「判了风险」。港股信号尤其如此 ——
                        「拆并股比例 0.200」本身就是可核查的事实。 */}
                    {flag.evidence ? (
                      <p className="num mt-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-[11px] text-fg-muted">
                        {flag.evidence}
                      </p>
                    ) : null}
                    {flag.source_query_id ? (
                      <p className="num mt-1.5 text-[10.5px] text-fg-subtle">
                        来源契约 {flag.source_query_id}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** 分项英文键 → 中文名 */
const LABELS: Record<string, string> = {
  "cheapness.valuation_percentile": "估值分位",
  "cheapness.absolute_valuation": "绝对估值",
  "cheapness.dividend_yield": "股息率",
  "cheapness.ncav_discount": "NCAV 折价",
  "quality.earnings_stability": "盈利稳定性",
  "quality.financial_soundness": "财务稳健",
  "quality.cash_flow_quality": "现金流质量",
  "quality.return_quality": "回报质量",
};

/** 金额缩写（用于紧凑卡片） */
function fmtMoneyShort(value: number | null): string {
  if (value === null) return DASH;
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}万亿`;
  if (abs >= 1e8) return `${(value / 1e8).toFixed(0)}亿`;
  if (abs >= 1e4) return `${(value / 1e4).toFixed(0)}万`;
  return value.toFixed(0);
}

export { fmtMoneyShort };
