"use client";

/**
 * 表格内的分数单元格 —— 带**视觉通道**。
 *
 * 为什么不能只放数字：一屏 40 行纯数字时，眼睛无法快速比较（92.0 与 80.2
 * 的差别需要逐行读数）。加一条等比例的背景条后，形状差异直接可见 ——
 * 这是数据表格可扫读性的关键。
 *
 * 实现用背景渐变而非嵌套 div：不增加 DOM 节点，不干扰表格布局。
 */

import { cn } from "@/lib/cn";
import { DASH } from "@/lib/format";

export function ScoreCell({
  value,
  digits = 1,
  tone = "auto",
  muted = false,
  title,
}: {
  value: number | null;
  digits?: number;
  /** `auto` 按 50 分界；也可强制指定色调。 */
  tone?: "auto" | "pass" | "fail" | "neutral";
  muted?: boolean;
  title?: string;
}) {
  if (value === null) {
    return (
      <span className={cn("text-fail", muted && "text-fg-subtle")} title={title}>
        {DASH}
      </span>
    );
  }

  const color =
    tone === "auto"
      ? value >= 50
        ? "var(--pass)"
        : "var(--fail)"
      : tone === "pass"
        ? "var(--pass)"
        : tone === "fail"
          ? "var(--fail)"
          : "var(--fg-subtle)";

  return (
    <span
      title={title}
      className="num relative inline-flex min-w-[3.25rem] justify-end rounded-md px-1.5 py-0.5 font-medium tabular-nums"
      style={{
        background: `linear-gradient(to right, color-mix(in oklab, ${color} 16%, transparent) ${value}%, transparent ${value}%)`,
        color,
      }}
    >
      {value.toFixed(digits)}
    </span>
  );
}

/** 覆盖率：用点阵表达，比百分比更快扫读。 */
export function CoverageDots({ value }: { value: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * 5);
  const low = value < 0.6;
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`数据覆盖率 ${(value * 100).toFixed(0)}%${low ? "（低于 60%，未输出总分）" : ""}`}
    >
      <span className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-1.5 rounded-full",
              index < filled ? (low ? "bg-warn" : "bg-pass/70") : "bg-line-strong/50",
            )}
          />
        ))}
      </span>
    </span>
  );
}
