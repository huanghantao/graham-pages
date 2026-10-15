"use client";

/**
 * 机构 / 个人持有比例条。
 *
 * ## 为什么在 20% 处画一条线
 *
 * 这不是我定的阈值，而是**监管披露线**：《公开募集证券投资基金信息披露
 * 管理办法》要求，报告期内单一投资者持有基金份额达到或超过 20% 时，
 * 管理人须在定期报告"影响投资者决策的其他重要信息"中披露该投资者的
 * 类别、持有份额及占比、持有变化情况及本基金特有风险。
 *
 * 跨过这条线意味着**监管本身已经认为它影响投资决策** ——
 * 因此它适合作为界面上的视觉锚点。
 *
 * ## 为什么用条而不是只给数字
 *
 * "机构 99%" 与 "机构 5%" 都是两位数，读起来差别不大；
 * 而一条几乎满格的橙色条会立刻传达"这只基金几乎全是机构的钱"。
 */

import { cn } from "@/lib/cn";

export function HolderBar({
  institutional,
  retail,
}: {
  institutional: number;
  retail: number | null;
}) {
  const inst = Math.max(0, Math.min(100, institutional));
  const risk = inst >= 20;

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full border border-line/70">
        <div
          className="h-full"
          style={{ width: `${inst}%`, background: risk ? "var(--warn)" : "var(--accent)" }}
          title={`机构持有 ${inst.toFixed(2)}%`}
        />
        <div
          className="h-full flex-1"
          style={{ background: "var(--pass)", opacity: 0.55 }}
          title={retail === null ? "个人持有比例未披露" : `个人持有 ${retail.toFixed(2)}%`}
        />
      </div>
      <div className="num mt-1.5 flex items-baseline justify-between text-[10.5px]">
        <span style={{ color: risk ? "var(--warn)" : "var(--fg-muted)" }}>
          机构 {inst.toFixed(2)}%
        </span>
        <span className="text-fg-subtle">
          {retail === null ? "个人未披露" : `个人 ${retail.toFixed(2)}%`}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className={cn(
            "num rounded px-1 text-[9.5px]",
            risk ? "text-warn" : "text-fg-subtle",
          )}
        >
          20% 监管披露线
        </span>
        <div className="h-px flex-1 bg-line/60" />
      </div>
    </div>
  );
}
