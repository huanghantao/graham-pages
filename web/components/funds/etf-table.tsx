"use client";

/**
 * 低成本指数方案。
 *
 * 设计文档的原话：「对绝大多数人，格雷厄姆本人的建议是低成本指数」。
 * 这一块是本站的**兜底路径** —— 避免它变成只会推荐个股的高风险工具。
 *
 * ## 费率为什么值得单独一页来讲
 *
 * 同一个宽基指数下，不同 ETF 的管理费率实测从 **0.15% 到 0.5%**（相差 3 倍以上）。
 * 跟踪同一个指数、持仓几乎一样，唯一稳定差异就是费率 ——
 * 而它在长期复利下会显著侵蚀收益。让费率可横向比较，正是这块的价值。
 * 否则用户得去翻几十份招募说明书。
 */

import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import type { EtfRow } from "@/lib/types";

export function EtfTable({ etfs }: { etfs: EtfRow[] }) {
  if (etfs.length === 0) return null;

  // 按跟踪指数分组，让同指数的费率可以直接横向比较
  const grouped = new Map<string, EtfRow[]>();
  for (const etf of etfs) {
    const list = grouped.get(etf.tracked_index) ?? [];
    list.push(etf);
    grouped.set(etf.tracked_index, list);
  }

  return (
    <Card>
      <CardHeader
        title="低成本指数方案"
        hint={`${grouped.size} 个宽基指数 · ${etfs.length} 只 ETF`}
      />
      <CardBody className="space-y-4 pt-4">
        <p className="text-[11.5px] leading-5 text-fg-subtle">
          对绝大多数投资者，格雷厄姆本人的建议是<strong className="text-fg-muted">持有分散化的低成本指数</strong>，
          而不是自己选股。下面按跟踪指数分组列出规模较大的选项，
          <strong className="text-fg-muted">同组内的费率可直接横向比较</strong> ——
          跟踪同一指数的基金持仓几乎一样，唯一稳定差异就是费率，
          而它在长期复利下会显著侵蚀收益。
        </p>

        <div className="space-y-3.5">
          {[...grouped.entries()].map(([indexName, rows]) => (
            <div key={indexName}>
              <div className="micro mb-1.5 flex items-center gap-2">
                <span>{indexName}</span>
                <Badge tone="neutral">{rows.length} 只</Badge>
              </div>
              <ul className="space-y-1">
                {rows.map((etf) => (
                  <li
                    key={etf.code}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-surface/70"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{etf.name}</span>
                    <span className="num text-[11px] text-fg-subtle">{etf.code}</span>
                    <span className="num w-20 text-right text-[11.5px] text-fg-muted">
                      {etf.fund_size === null ? "—" : `${(etf.fund_size / 1e8).toFixed(1)} 亿`}
                    </span>
                    <span
                      className="num w-16 text-right text-[12px] font-medium"
                      style={{
                        color:
                          etf.management_fee !== null && etf.management_fee <= 0.15
                            ? "var(--pass)"
                            : undefined,
                      }}
                      title="管理费率 —— 长期复利下的稳定成本"
                    >
                      {etf.management_fee === null ? "—" : `${etf.management_fee}%`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
