"use client";

/**
 * 个股页的标签页容器。
 *
 * 把原本 3,000px 的长滚动拆成四个语义明确的标签页：
 * 概览 / 判据 / 财务 / 溯源。
 *
 * 为什么这样切分：
 * - **概览**回答"这家公司值不值得继续看"（结论 + 关键指标 + 估值）；
 * - **判据**回答"为什么得出这个结论"（七条判据 + 出处）；
 * - **财务**回答"基本面是什么样"（趋势 + NCAV + 风险）；
 * - **溯源**回答"这些数字哪来的"（上游接口的实际解析 + 不可用信号）。
 *
 * 切分依据是**用户的问题**，而不是数据的类型 —— 这决定了标签名是否好懂。
 */

import { useState } from "react";

import { Tabs } from "@/components/ui/interactive";
import { fmtInt } from "@/lib/format";
import type { StockDetail } from "@/lib/types";

import { CriteriaPanel } from "./panels/criteria";
import { FinancePanel } from "./panels/finance";
import { OverviewPanel } from "./panels/overview";
import { ProvenancePanel } from "./panels/provenance";

type TabId = "overview" | "criteria" | "finance" | "provenance";

export function StockTabs({ detail }: { detail: StockDetail }) {
  const [tab, setTab] = useState<TabId>("overview");

  const tabs = [
    { value: "overview" as const, label: "概览" },
    {
      value: "criteria" as const,
      label: "判据",
      badge: detail.criteria?.total,
    },
    { value: "finance" as const, label: "财务" },
    {
      value: "provenance" as const,
      label: "溯源",
      badge: detail.provenance.length,
    },
  ];

  return (
    <div>
      <Tabs
        tabs={tabs}
        value={tab}
        onChange={setTab}
        trailing={
          <span className="hidden text-[11px] text-fg-subtle sm:block">
            {detail.as_of ? `快照 ${detail.as_of}` : ""} · 观测{" "}
            {fmtInt(detail.provenance.reduce((sum, entry) => sum + entry.row_count, 0))} 行
          </span>
        }
      />

      <div key={tab} className="animate-rise pt-5">
        {tab === "overview" ? <OverviewPanel detail={detail} /> : null}
        {tab === "criteria" ? <CriteriaPanel detail={detail} /> : null}
        {tab === "finance" ? <FinancePanel detail={detail} /> : null}
        {tab === "provenance" ? <ProvenancePanel detail={detail} /> : null}
      </div>
    </div>
  );
}
