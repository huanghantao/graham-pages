"use client";

/**
 * 涨跌幅单元格。
 *
 * 涨跌是有方向的量，因此**必须带符号**（数字本身可能是负数，
 * 但只在数字前加负号不够醒目 —— 用户需要一眼扫出方向）。
 *
 * 视觉设计：
 * - 用 `▲/▼` 三角而非单纯的正负号，形状差异比符号更快被识别；
 * - 颜色只用于方向，深浅反映幅度（避免"涨得少的和涨得多的看起来一样"）；
 * - 幅度背景条让横跨 ±100% 的极端值（如退市股的 −96%）一眼可见。
 */

import { cn } from "@/lib/cn";
import { DASH } from "@/lib/format";

export function DeltaCell({
  value,
  digits = 1,
  showBar = true,
  className,
}: {
  value: number | null;
  digits?: number;
  /** 是否绘制幅度背景条。幅度极大时（±90%）背景条最有价值。 */
  showBar?: boolean;
  className?: string;
}) {
  if (value === null || Number.isNaN(value)) {
    return <span className={cn("num text-fg-subtle", className)}>{DASH}</span>;
  }

  const up = value > 0;
  const flat = value === 0;
  const color = flat ? "var(--fg-subtle)" : up ? "var(--pass)" : "var(--fail)";

  // 背景条宽度：以 ±50% 为满格，超出部分截断（退市股的 −96% 会填满）
  const magnitude = Math.min(1, Math.abs(value) / 50);
  const width = magnitude * 100;

  return (
    <span
      className={cn("num relative inline-flex min-w-[4rem] justify-end gap-1 rounded-md px-1.5 py-0.5 tabular-nums", className)}
      style={{
        color,
        background: showBar
          ? `linear-gradient(to ${up ? "right" : "left"}, color-mix(in oklab, ${color} 18%, transparent) ${width}%, transparent ${width}%)`
          : undefined,
      }}
    >
      <span aria-hidden className="text-[9px] leading-none opacity-80">
        {flat ? "" : up ? "▲" : "▼"}
      </span>
      {value.toFixed(digits)}
    </span>
  );
}
