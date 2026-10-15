"use client";

/**
 * 财务面板：回答"基本面是什么样"。
 *
 * 折线图带悬停十字线 —— 这是必需的：趋势图的价值在于**读取具体某期的值**，
 * 静态补线只能看走势，无法回答"2024 年到底亏了多少"。
 */

import { LineChart } from "@/components/charts";
import { Card, CardBody, CardHeader, Notice, Stat } from "@/components/ui";
import { DASH, fmtMoney, fmtPercent, yearOf } from "@/lib/format";
import type { StockDetail } from "@/lib/types";

/** 趋势图的展示顺序（收入规模 → 盈利质量 → 杠杆） */
const ORDER = ["net_income", "operating_cash_flow", "roe", "debt_ratio", "revenue"] as const;

export function FinancePanel({ detail }: { detail: StockDetail }) {
  // 金额类趋势图必须知道币种：A 股是人民币、港股是港元。
  // 不做汇率换算，只如实标注单位。
  const currency = (detail.market_profile?.currency ?? "CNY").toLowerCase();
  const series = Object.entries(detail.trend).sort(([a], [b]) => {
    const ai = ORDER.indexOf(a as (typeof ORDER)[number]);
    const bi = ORDER.indexOf(b as (typeof ORDER)[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (series.length === 0) {
    return (
      <Card>
        <CardBody>
          <Notice tone="warn" title="无年度序列数据">
            该标的没有可用的完整年度财务序列。港股通常只返回单期数据，
            因此无法绘制多年趋势，也无法评估盈利稳定性与增长率。
          </Notice>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {series.map(([key, item]) => {
        const points = item.points.map(([iso, value]) => ({
          label: `${yearOf(iso)} 年`,
          value,
        }));
        const latest = item.points[item.points.length - 1]?.[1] ?? null;
        const isPercent = item.unit === "%";
        const first = item.points[0]?.[1] ?? null;

        // 变化量：只对同口径的相邻首尾做差，避免误读
        const delta =
          latest !== null && first !== null && !isPercent
            ? latest - first
            : null;

        return (
          <Card key={key} className={key === "net_income" ? "lg:col-span-2" : undefined}>
            <CardHeader
              title={item.label}
              hint={item.unit === "%" ? "单位 %" : `单位 ${item.unit}`}
              action={
                <div className="flex items-center gap-4">
                  <Stat
                    label="最新"
                    value={
                      latest === null
                        ? DASH
                        : isPercent
                          ? fmtPercent(latest)
                          : fmtMoney(latest, 1, currency)
                    }
                    size="sm"
                    tone={
                      latest === null
                        ? "neutral"
                        : isPercent
                          ? latest >= 10
                            ? "pass"
                            : "neutral"
                          : latest >= 0
                            ? "pass"
                            : "fail"
                    }
                  />
                  {delta !== null ? (
                    <Stat
                      label="区间变化"
                      value={`${delta >= 0 ? "+" : ""}${fmtMoney(delta, 1, currency)}`}
                      size="sm"
                      tone={delta >= 0 ? "pass" : "fail"}
                    />
                  ) : null}
                </div>
              }
            />
            <CardBody className="pt-3">
              <LineChart
                points={points}
                unit={isPercent ? "%" : undefined}
                valueLabel={item.label}
                height={key === "net_income" ? 200 : 160}
                formatValue={(value) =>
                  isPercent ? `${value.toFixed(2)}%` : fmtMoney(value, 1, currency)
                }
              />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
