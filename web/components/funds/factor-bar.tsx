"use client";

/**
 * 因子条：原始值 + 同类百分位。
 *
 * ## 为什么用条而不是数字
 *
 * 百分位是**相对位置**，不是绝对量。一排 `87 42 95` 需要用户逐个数换算成
 * "在同类里靠前还是靠后"；而条形把这件事变成一眼可辨——
 * 这正是排行榜场景最需要的。
 *
 * ## 为什么数字必须是**原始值**而不是百分位
 *
 * 初版把**百分位**（如 `84`）显示为数字，把**原始值**（如 `13.58%`）放在
 * `title` 里 —— 这是个设计倒置，而且后果不只是"不方便"：
 *
 * * 条形**本身就是百分位的视觉编码**，再写一个数字是重复的；
 *   而原始值是整行里**唯一没有视觉表达**的信息。
 * * `title` 在**触屏设备上根本不显示**，也就是说手机上
 *   这一行只有条形、没有任何绝对数值 —— 数据完全不可得。
 *   键盘用户同样取不到（`title` 不可聚焦）。
 *
 * 因此现在显示原始值，百分位退到 `title` 里（条形已表达它）。
 *
 * ## 为什么有些因子只有文字没有条
 *
 * 因子可能处于三种状态，含义完全不同：
 *
 * * **有值** → 画条（参与评分）
 * * **适用但取不到**（``missing``）→ 灰字"数据缺失"（不该被当成 0 分）
 * * **本就不适用**（``not_applicable``）→ 灰字给出原因（如"成立不足 10 年"）
 *
 * 把它们统一画成空条会让用户以为"这只基金这项很差"，
 * 而事实可能是"这项指标对它本就没有意义"。
 */

import { cn } from "@/lib/cn";
import type { FundFactorScore, FundFactorSpec } from "@/lib/types";

export function FactorRow({
  spec,
  score,
  missing,
  notApplicable,
}: {
  spec: FundFactorSpec;
  score: FundFactorScore | undefined;
  missing: boolean;
  /** 不适用时的原因；为空表示适用。 */
  notApplicable: string;
}) {
  const label = (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="truncate text-[10.5px] text-fg-subtle">{spec.label}</span>
      <span
        className="num shrink-0 text-[9.5px] text-fg-subtle opacity-70"
        title={`权重 ${(spec.weight * 100).toFixed(0)}%`}
      >
        {(spec.weight * 100).toFixed(0)}%
      </span>
    </span>
  );

  if (notApplicable) {
    return (
      <div className="min-w-0" title={notApplicable}>
        {label}
        <div className="mt-1 truncate text-[11px] text-fg-subtle">不适用</div>
      </div>
    );
  }

  if (missing || score === undefined) {
    return (
      <div className="min-w-0" title="该因子适用，但本批次未取到数据">
        {label}
        <div className="mt-1 text-[11px] text-warn/80">数据缺失</div>
      </div>
    );
  }

  // 百分位越高越好（方向已在服务端归一）。
  // 颜色编码的是**相对位置**，因此仍由百分位决定。
  const tone =
    score.percentile >= 70
      ? "var(--pass)"
      : score.percentile >= 40
        ? "var(--accent)"
        : "var(--warn)";

  // 原始值保留两位；单位由服务端声明，前端不按因子键硬编码
  // （硬编码的映射表会在因子集演进时静默漂移）
  const raw = `${score.raw.toFixed(2)}${spec.display_unit}`;

  return (
    <div
      className="min-w-0"
      title={`${spec.label}：原始值 ${raw}，同类百分位 ${score.percentile.toFixed(0)}（第 ${(100 - score.percentile).toFixed(0)} 分位起算的反向位置见条形长度）`}
    >
      {label}
      <div className="mt-1 flex items-center gap-1.5">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full"
            style={{ width: `${score.percentile}%`, background: tone }}
          />
        </div>
        <span
          className="num shrink-0 text-[10.5px] font-medium tabular-nums"
          style={{ color: tone }}
        >
          {raw}
        </span>
      </div>
    </div>
  );
}

/** 覆盖率提示。 */
export function CoverageNote({ coverage }: { coverage: number }) {
  if (coverage >= 0.999) {
    return <span className="num text-[10.5px] text-fg-subtle">覆盖 100%</span>;
  }
  return (
    <span
      className={cn("num text-[10.5px]", coverage < 0.6 ? "text-fail" : "text-fg-subtle")}
      title="可得因子权重 ÷ 适用因子权重"
    >
      覆盖 {(coverage * 100).toFixed(0)}%
    </span>
  );
}
