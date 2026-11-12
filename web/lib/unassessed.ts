/**
 * 「未能复核」在**列表行**上的判定与文案。
 *
 * 个股详情页有完整版面讲清这件事，榜单与筛选表没有那个空间 —— 但那正是
 * 用户做决定的地方。若只在详情页披露，一只流动性从未被复核过的标的在榜单上
 * 看起来和复核通过的一模一样，而它缺失的那一格刚好是最关键的一列。
 *
 * 因此这里提供三个最小工具：某行缺了哪些指标、某个具体指标是不是缺的、
 * 以及一行能放进徽标的文案。全部是纯函数，可直接单测。
 */

import type { UnassessedSignal } from "@/lib/types";

/** 能携带盲区的行（`StrategyHit` / `ScoreRow` 都符合）。 */
export interface UnassessedCarrier {
  unassessed_signals?: UnassessedSignal[];
}

/**
 * 某项指标是否因数据缺失而无法复核。
 *
 * 缺键与空数组都视为"没有盲区" —— 列表载荷刻意稀疏（见 `lib/types.ts`），
 * 把 `undefined` 当异常处理会让绝大多数行报错。
 */
export function isMetricUnassessed(row: UnassessedCarrier, metric: string): boolean {
  return (row.unassessed_signals ?? []).some(
    (item) => item.missing_metric === metric,
  );
}

/**
 * 某个指标缺失时的中文名；该指标没缺失时返回 `undefined`。
 *
 * 文案一律取自服务端载荷（`missing_label`），界面不自带词表：
 * 指标名与阈值都住在 `graham.domain.metrics`，两处各存一份必然分叉。
 */
export function missingLabelFor(
  row: UnassessedCarrier,
  metric: string,
): string | undefined {
  return (row.unassessed_signals ?? []).find((item) => item.missing_metric === metric)
    ?.missing_label;
}

/**
 * 徽标文案：`未复核 2 项`；无盲区时返回 `null`。
 *
 * 只给数量不给结论：这些信号"若能复核且命中"会扣多少分是另一件事，
 * 而缺失本身不代表风险。用"雷区"或"预警"命名会把它读成已发生的坏事。
 */
export function unassessedLabel(row: UnassessedCarrier): string | null {
  const count = (row.unassessed_signals ?? []).length;
  return count === 0 ? null : `未复核 ${count} 项`;
}

/**
 * 悬停提示：逐条列出信号名与缺失的指标。
 *
 * 徽标只放得下数量，但用户需要知道**缺的是什么** —— "未复核 2 项"若不说
 * 缺哪两个指标，读者无法判断这个缺口与自己有关无关。
 */
export function unassessedTooltip(row: UnassessedCarrier): string | undefined {
  const items = row.unassessed_signals ?? [];
  if (items.length === 0) return undefined;
  return items
    .map((item) => `${item.title}（缺少「${item.missing_label ?? item.missing_metric}」）`)
    .join("\n");
}
