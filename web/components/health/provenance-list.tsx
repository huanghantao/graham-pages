"use client";

/**
 * 契约校验列表（客户端，可切换"仅看有问题的"）。
 *
 * 这是数据健康页的主体：把上游接口对每个查询的**实际语义解析**摊开。
 */

import { useState } from "react";

import { Badge, Disclosure, Notice, Tabs } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";
import type { ProvenanceEntry } from "@/lib/types";

export function ProvenanceList({ entries }: { entries: ProvenanceEntry[] }) {
  const issueCount = entries.filter(
    (entry) => !entry.passed || entry.warnings.length > 0,
  ).length;

  // 默认视图按状态决定：有告警时直接看告警，全通过时看全部。
  // 这样"有问题"永远不需要用户再点一次才可见。
  const [filter, setFilter] = useState<"all" | "issues">(
    issueCount > 0 ? "issues" : "all",
  );
  const issues = entries.filter(
    (entry) => !entry.passed || entry.warnings.length > 0,
  );
  const shown = filter === "issues" ? issues : entries;

  return (
    <div className="space-y-3">
      <Tabs
        tabs={[
          { value: "all" as const, label: "全部契约", badge: entries.length },
          { value: "issues" as const, label: "有告警", badge: issueCount },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {issues.length === 0 ? (
        <Notice tone="pass" title="全部契约通过且无告警">
          本次抓取的语义解析与预期完全一致 —— 共 {entries.length} 条契约，
          上游接口对每条的解析都与预期口径相符。
          <span className="mt-1 block text-fg-subtle">
            明细默认收起以保持页面简洁。逐条展开可见上游接口对每个查询的原文理解。
          </span>
        </Notice>
      ) : null}

      {/* 明细：全通过时默认收起（4,500px ≈ 手机 5.3 屏），有问题时展开 */}
      <Disclosure
        summary="逐条解析明细"
        hint={`${entries.length} 条`}
        defaultOpen={issueCount > 0}
        tone="muted"
      >
        <ul className="space-y-2">
          {shown.map((entry) => {
            const clean = entry.passed && entry.warnings.length === 0;
            return (
              <li
                key={entry.query_id}
                className={cn(
                  "rounded-xl border p-3.5",
                  entry.passed ? "border-line/70" : "border-fail/30 bg-fail-bg",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span
                    className={cn("num text-[13px]", entry.passed ? "text-pass" : "text-fail")}
                    aria-hidden
                  >
                    {entry.passed ? "✓" : "✗"}
                  </span>
                  <code className="num text-[11.5px] font-medium">{entry.query_id}</code>
                  <span className="num text-[11px] text-fg-subtle">
                    {fmtInt(entry.row_count)} 行
                  </span>
                  {entry.warnings.length > 0 ? (
                    <Badge tone="warn">{entry.warnings.length} 告警</Badge>
                  ) : null}
                  {clean ? <Badge tone="pass">通过</Badge> : null}
                  {/*
                    ★ 此处原有一个 trace 号（上游为每次调用生成的追踪 id）。
                    它已从快照中移除：站点不公开上游身份。
                  */}
                </div>

                <ul className="mt-2 space-y-1">
                  {entry.chunks_info.length > 0 ? (
                    entry.chunks_info.map((chunk) => (
                      <li key={chunk} className="num text-[11.5px] leading-5 text-fg-muted">
                        {chunk}
                      </li>
                    ))
                  ) : (
                    <li className="text-[11.5px] text-fg-subtle">（无解析片段）</li>
                  )}
                </ul>

                {entry.violations.map((violation) => (
                  <p key={violation} className="mt-1.5 text-[11.5px] leading-5 text-fail">
                    违约：{violation}
                  </p>
                ))}
                {entry.warnings.map((warning) => (
                  <p key={warning} className="mt-1.5 text-[11.5px] leading-5 text-warn">
                    告警：{warning}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      </Disclosure>
    </div>
  );
}
