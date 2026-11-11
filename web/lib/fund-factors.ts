/**
 * 基金因子的**展示口径**。
 *
 * 组件只负责排版；"把一个数字翻译成人话"的规则集中在这里，因此这些规则
 * 可以被单元测试直接覆盖（`node --test lib/fund-factors.test.ts`），
 * 不必渲染 DOM、也不必依赖浏览器环境。
 *
 * ## 为什么权重不在因子行里
 *
 * 权重是一个不加标注的百分数，一旦与因子名并排出现，读者就会把它读成
 * 这个因子本身的值：
 *
 * ```text
 * 近 5 年年化收益 16%      ← 权重，不是收益
 * ▓▓▓▓▓▓▓ 13.17%           ← 原始值
 * ```
 *
 * 这类误读不会自我暴露：以本仓库快照实测，全部 7 个类别里百分数类因子的
 * 7,929 个（基金 × 因子）单元格中，有 1,658 个（20.9%）权重与原始值
 * 相差不超过 3 个百分点 —— **把权重当成收益读，数值上完全说得通**，
 * 读者的常识不会拦住它。
 *
 * 而权重本身也不适合逐只出现：
 *
 * * 它是**类别元数据**，同类下每只基金都相同，逐只重复不携带信息；
 * * 评分时按可得因子重归一（见 `domain/fund_factor.py` 的
 *   `weight` 说明），因此逐只显示的那个声明值**对这只基金并不准确**。
 *
 * 于是权重改为每类别披露一次（见 `WeightComposition`）。
 *
 * ## 为什么额外用文字表达位置
 *
 * 条形长度编码百分位，条尾数字是原始值 —— 两者不同量纲，读者既无法从
 * 条形反推数值，也无法从数值反推条形。补一句"同类前 18%"，
 * 位置判断就不必再由读者自己换算。
 */

import type { FundFactorSpec } from "@/lib/types";

/** 百分位分档阈值：达到 `good` 记为上游，达到 `fair` 记为中游，其余为下游。 */
export const PERCENTILE_BANDS = { good: 70, fair: 40 } as const;

/** 因子相对同类的档位。组件据此选配色，避免阈值散落在 JSX 里。 */
export type FactorTone = "good" | "fair" | "poor";

/** 因子在同类中的位置描述。 */
export interface PeerStanding {
  /** 位于上半区（含中位）为 `top`，下半区为 `bottom`。 */
  side: "top" | "bottom";
  /** 面向读者的短标签，如 `同类前 18%`。 */
  label: string;
}

/** 某个因子在"可得因子总权重"里占的份量。 */
export interface WeightShare {
  spec: FundFactorSpec;
  /** 占合计权重的百分比（0~100），各份量之和恒为 100。 */
  share: number;
}

/**
 * 把百分位翻译成"同类前 X% / 同类后 Y%"。
 *
 * 百分位由中位秩公式得出（见 `analytics/fund_scoring.percentile_of`），
 * 含义是**比它更差的同类占比**，且已按因子方向调整为"越高越好"。
 * 因此 `100 - 百分位` 就是比它更好的同类占比，可以原样说成"前 X%"，
 * 不需要任何额外假设。
 *
 * 只报单侧：中位及以上说"前"，中位以下说"后"。这样既避免了
 * "同类前 97%"这种读着像夸奖、实际在说垫底的表述，也让数字始终是
 * 读者关心的那一侧。
 *
 * Args:
 *   percentile: 同类内百分位（0~100，越高越好）。
 *
 * Returns:
 *   位置描述；`label` 中的百分比至少为 1，不会出现"前 0%"。
 */
export function peerStanding(percentile: number): PeerStanding {
  const beaten = clampPercentile(percentile);
  const better = 100 - beaten;
  return better <= 50
    ? { side: "top", label: `同类前 ${atLeastOnePercent(better)}%` }
    : { side: "bottom", label: `同类后 ${atLeastOnePercent(beaten)}%` };
}

/**
 * 百分位 → 配色档位。
 *
 * 颜色编码的是**相对位置**而不是原始值大小，因此阈值作用在百分位上：
 * 同类的第一名与最后一名，在任何因子上都该分别显示为最好与最差。
 */
export function factorTone(percentile: number): FactorTone {
  const beaten = clampPercentile(percentile);
  if (beaten >= PERCENTILE_BANDS.good) return "good";
  if (beaten >= PERCENTILE_BANDS.fair) return "fair";
  return "poor";
}

/**
 * 权重 → `16%`。
 *
 * 两位小数的精度对这个场景没有意义（权重是人工声明的常量），
 * 因此在整数百分点上取整。
 */
export function formatWeight(weight: number): string {
  return `${(clampUnit(weight) * 100).toFixed(0)}%`;
}

/**
 * 按权重从大到小排出各因子的相对份量，供"评分构成"一次性披露。
 *
 * 分母用**实际合计**而不是假定的 1：权重表是服务端下发的数据，一旦因子集
 * 改动后忘了配平，按 1 归一会让各份量之和不为 100%，堆叠条上就会出现
 * 一条无法解释的缺口。用实际合计归一后，条形永远恰好铺满。
 *
 * Args:
 *   factors: 对该类别适用的因子声明。
 *
 * Returns:
 *   按份量降序排列的列表；权重合计为 0 时返回空数组
 *   （此时没有任何因子参与评分，披露构成没有意义）。
 */
export function weightComposition(
  factors: readonly FundFactorSpec[],
): WeightShare[] {
  const total = factors.reduce((sum, spec) => sum + clampUnit(spec.weight), 0);
  if (total <= 0) return [];
  return factors
    .map((spec) => ({ spec, share: (clampUnit(spec.weight) / total) * 100 }))
    .sort((left, right) => right.share - left.share);
}

/**
 * 把百分位收敛到 0~100。
 *
 * 非有限值按中位（50）处理：正常流程不会产生 NaN，但展示层不该因为一个
 * 坏值把整行渲染成"同类前 NaN%"或让条形撑出容器。
 *
 * 公开导出是为了让**条形宽度**与**文字位置**用同一套边界 ——
 * 两处各写一遍收敛，迟早会有一条路径漏掉。
 */
export function clampPercentile(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

/** 把权重收敛到 0~1，避免脏数据把条形撑出容器。 */
function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 四舍五入到整数百分点，并保证至少为 1%（"前 0%"读不通）。 */
function atLeastOnePercent(value: number): number {
  return Math.max(1, Math.round(value));
}
