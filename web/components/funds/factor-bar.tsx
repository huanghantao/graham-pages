"use client";

/**
 * 因子行：一个因子的**原始值**与它在**同类中的位置**。
 *
 * ## 一行里只有三件事，各有唯一编码
 *
 * ```text
 * 近 5 年年化收益            同类前 18%   ← 因子名 / 相对位置（文字）
 * ▓▓▓▓▓▓▓▓▓ 13.17%                        ← 条形 = 百分位；数字 = 原始值
 * ```
 *
 * **位置**用文字、**相对高低**用条形、**绝对量**用数字。三者互不重叠，
 * 读者不需要从任何一个反推另一个。
 *
 * ## 为什么数字是原始值而不是百分位
 *
 * 条形本身就是百分位的视觉编码，条尾再写一个百分位是重复；位置已由
 * "同类前 X%"用文字给出。而原始值是整行里**唯一没有视觉表达**的信息。
 *
 * 反过来把原始值塞进 `title` 是不行的：`title` 在**触屏设备上根本不显示**，
 * 键盘用户也取不到（`title` 不可聚焦），读屏器的支持同样不一致 ——
 * 那等于手机上这一行没有任何绝对数值。
 *
 * ## 为什么权重不在这里
 *
 * 一个不加标注的权重百分数贴在因子名后，读者会把它读成这个因子本身的值 ——
 * 以本仓库快照实测，百分数类因子有 20.9% 的单元格里两者相差不到 3 个百分点，
 * 误读在数值上完全说得通。完整理由、以及权重现在披露在何处，
 * 见 `lib/fund-factors.ts` 的模块说明与 `WeightComposition`。
 *
 * ## 为什么有些因子只有文字没有条
 *
 * 因子可能处于三种状态，含义完全不同：
 *
 * * **有值** → 画条（参与评分）
 * * **适用但取不到**（`missing`）→ 灰字"数据缺失"（不该被当成 0 分）
 * * **本就不适用**（`not_applicable`）→ 灰字给出原因（如"成立不足 10 年"）
 *
 * 把它们统一画成空条会让用户以为"这只基金这项很差"，
 * 而事实可能是"这项指标对它本就没有意义"。
 */

import { cn } from "@/lib/cn";
import {
  clampPercentile,
  factorTone,
  peerStanding,
  type FactorTone,
} from "@/lib/fund-factors";
import type { FundFactorScore, FundFactorSpec } from "@/lib/types";

/** 档位 → 配色。档位由 `lib/fund-factors` 判定，这里只做取值映射。 */
const TONE_COLOR: Record<FactorTone, string> = {
  good: "var(--pass)",
  fair: "var(--accent)",
  poor: "var(--warn)",
};

/** 因子名。三种状态共用，保证同一列里的名字始终对齐。 */
function FactorName({ label }: { label: string }) {
  // min-w-0 是必需的：作为 flex 子项时，默认的 min-width:auto 会让
  // truncate 失效，长因子名会把同一行的位置标签挤出格子。
  return <span className="min-w-0 truncate text-[10.5px] text-fg-subtle">{label}</span>;
}

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
  if (notApplicable) {
    return (
      <div className="min-w-0" title={notApplicable}>
        <FactorName label={spec.label} />
        <div className="mt-1 truncate text-[11px] text-fg-subtle">不适用</div>
      </div>
    );
  }

  if (missing || score === undefined) {
    return (
      <div className="min-w-0" title="该因子适用，但本批次未取到数据">
        <FactorName label={spec.label} />
        <div className="mt-1 text-[11px] text-warn/80">数据缺失</div>
      </div>
    );
  }

  const color = TONE_COLOR[factorTone(score.percentile)];
  // 原始值保留两位；单位由服务端声明，前端不按因子键硬编码
  // （硬编码的映射表会在因子集演进时静默漂移）
  const raw = `${score.raw.toFixed(2)}${spec.display_unit}`;
  const standing = peerStanding(score.percentile);

  return (
    <div
      className="min-w-0"
      title={`${spec.label}：${raw}，${standing.label}（同类百分位 ${score.percentile.toFixed(0)} / 100）`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <FactorName label={spec.label} />
        <span className="num shrink-0 text-[9.5px] text-fg-subtle">
          {standing.label}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        {/* 条形是百分位的视觉表达，同一信息已由"同类前 X%"给出，
            因此对读屏软件隐藏，避免重复朗读。 */}
        <div
          aria-hidden
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${clampPercentile(score.percentile)}%`,
              background: color,
            }}
          />
        </div>
        <span
          className="num shrink-0 text-[10.5px] font-medium tabular-nums"
          style={{ color }}
        >
          {raw}
        </span>
      </div>
    </div>
  );
}

/**
 * 因子行的读法。
 *
 * 每张榜只渲染一次：条形与数字是两个不同量纲的编码，不给一次说明，
 * 读者会把条形长度当成数值大小。
 */
export function FactorRowLegend() {
  return (
    <p className="text-[10.5px] leading-4 text-fg-subtle">
      <span className="text-fg-muted">条形长度</span> = 同类百分位（越长越好）
      <span className="mx-1">·</span>
      <span className="text-fg-muted">数字</span> = 因子原始值
      <span className="mx-1">·</span>
      <span className="text-fg-muted">同类前 X%</span> = 比它更好的同类占比
    </p>
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
