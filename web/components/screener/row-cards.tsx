"use client";

/**
 * 移动端结果卡片。
 *
 * 为什么手机上不能用表格：本表有 8 列，横向滚动会让"比较两只股票"
 * 变成反复左右拖动 —— 而比较正是这个页面的全部意义。
 *
 * 卡片布局重新组织信息优先级：
 * 1. 名称 + 代码（识别）
 * 2. 安全边际 + 象限（结论）
 * 3. 三个分数 + 动量（依据）
 * 所有信息在一屏宽度内呈现，无需横向滚动。
 */

import Link from "next/link";

import { Badge, CoverageDots, DeltaCell, ScoreCell } from "@/components/ui";
import { fmt, fmtRatio } from "@/lib/format";
import type { ScoreRow } from "@/lib/types";

import { QUADRANT_META } from "./filters";
import { TurnoverCell } from "./turnover-cell";

/**
 * 筛选结果的移动端卡片列表。
 *
 * ★ **不要在这里加 `lg:hidden`。** 桌面/移动的切换由调用处的**整个容器**
 * 负责（见 `screener-client` 里的说明）：隐藏类若只挂在这个列表上，
 * 列表的分页按钮（由 `ProgressiveList` 渲染、与本列表是兄弟节点）
 * 就会在桌面端残留成一个孤立的「显示更多」。
 */
export function ResultCards({ rows }: { rows: ScoreRow[] }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const meta = QUADRANT_META[row.quadrant];
        return (
          <li
            key={row.code}
            className="rounded-xl border border-line/70 bg-bg-elevated p-3.5 shadow-card"
          >
            <Link href={`/stocks/${row.code}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{row.name}</div>
                  <div className="num mt-0.5 flex items-center gap-2 text-[11.5px] text-fg-subtle">
                    <span>{row.code}</span>
                    {row.industry ? <span>· {row.industry}</span> : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num text-[19px] font-semibold leading-none">
                    <ScoreCell value={row.mos} />
                  </div>
                  <div className="mt-1">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 border-t border-line/60 pt-3">
                <MiniField label="便宜度">
                  <ScoreCell value={row.cheapness} tone="neutral" digits={0} />
                </MiniField>
                <MiniField label="质量度">
                  <ScoreCell value={row.quality} tone="neutral" digits={0} />
                </MiniField>
                <MiniField label="覆盖率">
                  <CoverageDots value={row.coverage} />
                </MiniField>
                <MiniField label="日均成交额">
                  <TurnoverCell value={row.avg_turnover_20d} market={row.market} />
                </MiniField>
                <MiniField label="1 日">
                  <DeltaCell value={row.price_change_1d} showBar={false} />
                </MiniField>
                <MiniField label="1 月">
                  <DeltaCell value={row.price_change_1m} showBar={false} />
                </MiniField>
                <MiniField label="1 年">
                  <DeltaCell value={row.price_change_1y} />
                </MiniField>
              </div>

              {row.penalty > 0 ? (
                <div className="mt-2.5 rounded-lg border border-fail/25 bg-fail-bg px-2.5 py-1.5 text-[11.5px] text-fail">
                  雷区扣分 −{fmt(row.penalty, 0)}
                  <span className="ml-1.5 text-fg-subtle">
                    扣分来自监管或财务异常信号
                  </span>
                </div>
              ) : null}

              {row.mos === null && row.notes.length > 0 ? (
                <p className="mt-2 text-[11px] leading-4 text-warn/90">{row.notes[0]}</p>
              ) : null}

              <div className="num mt-2 flex items-center justify-between text-[10.5px] text-fg-subtle">
                <span>
                  {row.market === "hk_share" ? "港股" : "A股"}
                  {row.currency === "hkd" ? " · HKD" : ""}
                </span>
                <span>覆盖率 {fmtRatio(row.coverage)}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="micro truncate">{label}</div>
      <div className="mt-0.5 text-[12.5px]">{children}</div>
    </div>
  );
}
