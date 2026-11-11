/**
 * 评分构成：本类别里各因子的权重份量。
 *
 * ## 为什么它出现在榜单里
 *
 * 权重不在因子行里（理由见 `lib/fund-factors.ts`），因此"这些因子各占多少"
 * 必须有地方可看，且要能在**看数字的地方**看到 —— 若只收在页脚的模型说明里，
 * 读者得滚到底才能对照。
 *
 * 但它每类别只出现**一次**：权重是类别元数据，同类下每只基金都相同，
 * 逐只重复既没有信息量，也会重新制造"因子名旁多一个百分数"的歧义。
 *
 * ## 条形的两种读法都已给出
 *
 * 段宽是**相对份量**（各段之和恒为 100%），段旁的标签给的是**声明权重**。
 * 两者在配平的情况下数值相同；若声明权重没配平，段宽仍按实际合计归一，
 * 因此条形永远铺满 —— 依据见 `weightComposition`。
 */

import { formatWeight, weightComposition } from "@/lib/fund-factors";
import type { FundFactorSpec } from "@/lib/types";

/** 份量最小的那段仍要看得见，因此不透明度有下限。 */
const OPACITY_FLOOR = 0.3;

/**
 * 按份量排名给出段的不透明度。
 *
 * 用单一色相 + 明度阶梯而不是多种颜色：九个因子若各配一色，条形会变成
 * 一张需要图例才能读的调色板，反而比一组数字更难认。
 */
function segmentOpacity(index: number, total: number): number {
  if (total <= 1) return 1;
  return 1 - ((1 - OPACITY_FLOOR) / (total - 1)) * index;
}

export function WeightComposition({
  factors,
  heading,
}: {
  /** 对该类别适用的因子声明。 */
  factors: FundFactorSpec[];
  /** 区块标题；外层已经给出标题时（如详情页的卡片头）传 `undefined` 省略。 */
  heading?: string;
}) {
  const shares = weightComposition(factors);
  if (shares.length === 0) return null;

  return (
    <div className="rounded-xl border border-line/60 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {heading ? (
          <span className="text-[11px] font-medium text-fg-muted">{heading}</span>
        ) : (
          <span />
        )}
        <span className="text-[10px] text-fg-subtle">
          权重在可获得因子上重新归一
        </span>
      </div>

      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface">
        {shares.map(({ spec, share }, index) => (
          <div
            key={spec.key}
            style={{
              width: `${share}%`,
              background: "var(--accent)",
              opacity: segmentOpacity(index, shares.length),
            }}
            title={`${spec.label}：声明权重 ${formatWeight(spec.weight)}，占可得因子 ${share.toFixed(0)}%`}
          />
        ))}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {shares.map(({ spec }) => (
          <li key={spec.key} className="num text-[10px] text-fg-subtle">
            {spec.label}
            <span className="ml-1 text-fg-muted">{formatWeight(spec.weight)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
