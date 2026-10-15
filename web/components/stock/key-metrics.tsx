"use client";

/**
 * 关键指标网格（含**符号状态**）。
 *
 * 这是本项目最核心的设计原则在 UI 上的体现：只给数值会丢失最关键的信息。
 * `PE = 5.2` 与 `PE 不适用（公司亏损）` 对用户意味着完全不同的事，
 * 而把后者渲染成空白或 "—" 会让人误以为"没有数据"，甚至"没有问题"。
 *
 * 因此每个指标按状态分派呈现，且"不适用"必须带原因（悬停可见）。
 */

import { Tip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DASH, fmt, fmtMoney } from "@/lib/format";
import type { KeyMetric } from "@/lib/types";

/** 状态 → 呈现方式。 */
function present(metric: KeyMetric): {
  text: string;
  toneClass: string;
  note: string;
  emphatic: boolean;
} {
  const digits = metric.digits ?? 2;
  const percent = metric.unit === "percent";
  const money = metric.unit === "cny" || metric.unit === "hkd";

  // 币种取自指标自身的 unit —— 港股金额就是 hkd，
  // 传下去才不会把「3.87 万亿港元」显示成「3.87 万亿元」。
  const asNumber = (value: number) =>
    money ? fmtMoney(value, 1, metric.unit) : percent ? `${fmt(value, digits)}%` : fmt(value, digits);

  switch (metric.status) {
    case "ok":
      return { text: asNumber(metric.value ?? 0), toneClass: "text-fg", note: "", emphatic: false };
    case "exempt":
      return {
        text: metric.value === null ? "不适用" : asNumber(metric.value),
        toneClass: "text-muted-mark",
        note: metric.reason,
        emphatic: metric.value === null,
      };
    case "loss":
    case "neg_equity":
    case "non_positive":
      return { text: "不适用", toneClass: "text-fail", note: metric.reason, emphatic: true };
    case "abnormal":
      return { text: "数据异常", toneClass: "text-fail", note: metric.reason, emphatic: true };
    case "missing":
      return {
        text: DASH,
        toneClass: "text-fg-subtle",
        // 刻意明确"不是 0"：用户看到空格可能理解为"这项是零"，
        // 而估值场景里"取不到"与"是零"含义完全不同（如股息率为 0 vs 缺数据）。
        note: "未取到该字段；按缺失处理，不计为 0",
        emphatic: false,
      };
    default:
      return {
        text: metric.usable ? asNumber(metric.value ?? 0) : DASH,
        toneClass: metric.usable ? "text-fg" : "text-fg-subtle",
        note: metric.reason,
        emphatic: false,
      };
  }
}

export function KeyMetrics({ metrics }: { metrics: Record<string, KeyMetric> }) {
  const entries = Object.entries(metrics);
  if (entries.length === 0) {
    return <p className="text-[13px] text-fg-subtle">无关键指标数据</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map(([key, metric]) => {
        const { text, toneClass, note, emphatic } = present(metric);
        const body = (
          <div className="min-w-0">
            <div className="micro truncate">{metric.label}</div>
            <div
              className={cn(
                "num mt-1.5 truncate font-semibold tracking-tight",
                emphatic ? "text-[15px]" : "text-[19px]",
                toneClass,
              )}
            >
              {text}
            </div>
            {note && !metric.usable ? (
              <div className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-fg-subtle">
                {note}
              </div>
            ) : null}
          </div>
        );

        return note ? (
          <Tip key={key} content={note}>
            {body}
          </Tip>
        ) : (
          <div key={key}>{body}</div>
        );
      })}
    </div>
  );
}
