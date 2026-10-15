"use client";

/**
 * 日均成交额单元格。
 *
 * 为什么单列一个组件而不是复用 `fmtMoney`：流动性需要**可比较的判断**，
 * 不只是数字。日均 1,690 港元与日均 6,670 万港元都只是数字，
 * 但前者意味着根本无法建仓 —— 用户需要在扫读时立刻看出这个差别，
 * 而不是心算数量级后再对照阈值。
 *
 * 因此这里按成交额分三档着色，并把分档依据写在提示里。
 */

import { DASH, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

/** 分档阈值（当地货币）。与后端风险信号保持一致。 */
const UNTRADEABLE = 1e5; //  10 万：几乎无法交易
const THIN = 1e6; // 100 万：建仓困难

export function TurnoverCell({
  value,
  market,
  className,
}: {
  value: number | null;
  /** 市场（决定币种：A 股人民币、港股港元）。 */
  market?: string;
  className?: string;
}) {
  if (value === null || value === undefined) {
    return <span className={cn("num text-fg-subtle", className)}>{DASH}</span>;
  }

  const currency = market === "hk_share" ? "hkd" : "cny";
  const untradeable = value < UNTRADEABLE;
  const thin = !untradeable && value < THIN;

  return (
    <span
      className={cn(
        "num tabular-nums",
        untradeable ? "text-fail" : thin ? "text-warn" : "text-fg-muted",
        className,
      )}
      title={
        untradeable
          ? "日均成交额低于 10 万：几乎无法建仓，此处『便宜』多为流动性折价"
          : thin
            ? "日均成交额低于 100 万：建仓与减仓都会明显推动价格"
            : "流动性充裕"
      }
    >
      {untradeable ? "⚠ " : ""}
      {fmtMoney(value, 0, currency)}
    </span>
  );
}
