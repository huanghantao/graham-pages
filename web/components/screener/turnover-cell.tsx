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
  unassessedLabel,
  className,
}: {
  value: number | null;
  /** 市场（决定币种：A 股人民币、港股港元）。 */
  market?: string;
  /**
   * 值为空**是因为这项没被复核**时，缺失指标的中文名（如"近20日日均成交额"）。
   *
   * 与"没有这个数"必须分开呈现：`—` 会被读成"这只票没有该项"，而实际是
   * "这次没拿到、因此不知道"。实测港股有一批标的的上游不再返回成交额，
   * 它们恰恰是流动性最差的那一端 —— 若在此处退化成 `—`，名单上最该
   * 被警惕的行反而最干净。
   *
   * 文案由服务端载荷提供（见 `lib/unassessed.ts`），组件不自带词表。
   */
  unassessedLabel?: string;
  className?: string;
}) {
  if (value === null || value === undefined) {
    if (unassessedLabel) {
      return (
        <span
          className={cn("text-[11px] text-fg-subtle", className)}
          title={`缺少「${unassessedLabel}」：数据不足，未能复核（不参与扣分）`}
        >
          未复核
        </span>
      );
    }
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
