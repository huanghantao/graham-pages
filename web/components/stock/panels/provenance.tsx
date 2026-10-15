"use client";

/**
 * 溯源面板 —— 本站与同类产品的分水岭。
 *
 * 展示上游接口对每个查询的**实际语义解析**（`chunks_info`）。
 * 这为什么重要：上游接口对无法理解的查询不报错，而是返回一个看起来正常的结果。
 * 实测 `市盈绿小于10`（把"率"误写成"绿"）被解析为「阴线且市盈率<10倍」，
 * 命中数从 1,763 掉到 73 —— 只有这个字段能发现。
 *
 * 把所有查询的解析结果公开，用户就能自己判断"这个数字是怎么来的"。
 * 同时必须列出**本平台取不到的信号** —— 静默留空会让人误以为安全。
 */

import { useState } from "react";

import { Badge, Card, CardBody, CardHeader, Notice, Tabs } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";
import type { ProvenanceEntry, StockDetail } from "@/lib/types";

export function ProvenancePanel({ detail }: { detail: StockDetail }) {
  const [filter, setFilter] = useState<"all" | "issues">("all");

  const entries =
    filter === "issues"
      ? detail.provenance.filter((entry) => !entry.passed || entry.warnings.length > 0)
      : detail.provenance;
  const issueCount = detail.provenance.filter(
    (entry) => !entry.passed || entry.warnings.length > 0,
  ).length;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Card className="lg:col-span-8">
        <CardHeader
          title="数据溯源"
          hint="上游接口对每个查询的实际理解 · 本站不隐藏解析结果"
          action={
            issueCount > 0 ? (
              <Tabs
                tabs={[
                  { value: "all" as const, label: "全部", badge: detail.provenance.length },
                  { value: "issues" as const, label: "有告警", badge: issueCount },
                ]}
                value={filter}
                onChange={setFilter}
              />
            ) : null
          }
        />
        <CardBody className="space-y-2.5 pt-4">
          <p className="text-[11.5px] leading-5 text-fg-subtle">
            下表的{" "}
            <code className="num rounded border border-line/70 bg-surface px-1 py-px">
              chunks_info
            </code>{" "}
            是上游接口对自己如何理解该查询的回报。若某次解析与预期不符，它会原样出现在这里。
          </p>
          {entries.map((entry) => (
            <ProvenanceCard key={entry.query_id} entry={entry} />
          ))}
          {entries.length === 0 ? (
            <Notice>该筛选下没有条目。</Notice>
          ) : null}
        </CardBody>
      </Card>

      <div className="space-y-5 lg:col-span-4">
        {detail.unavailable_signals.length > 0 ? (
          <Card>
            <CardHeader title="本平台不可用的信号" />
            <CardBody className="space-y-3 pt-4">
              <Notice tone="warn">
                下面这些信号是<strong>取不到</strong>，而不是“没有风险”。
                静默留空会让人误以为安全，因此如实列出。
              </Notice>
              <ul className="space-y-3">
                {detail.unavailable_signals.map((signal, index) => {
                  const [name, ...rest] = signal.split("：");
                  return (
                    <li key={index} className="text-[12px] leading-5">
                      <div className="font-medium text-warn">{name}</div>
                      <p className="mt-0.5 text-fg-subtle">{rest.join("：")}</p>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="契约校验的四条断言" />
          <CardBody className="space-y-3 pt-4">
            <ol className="space-y-2 text-[12px] leading-5 text-fg-muted">
              <li>
                <span className="num mr-1.5 text-fg-subtle">1.</span>
                <code className="num text-[11.5px]">status_code == 0</code> —— 基础可用性
              </li>
              <li>
                <span className="num mr-1.5 text-fg-subtle">2.</span>
                <strong className="text-fg">语义检查</strong>：
                <code className="num ml-1 text-[11.5px]">chunks_info</code>{" "}
                必须包含必需概念且不含技术形态词。这是唯一能发现“静默语义漂移”的断言。
              </li>
              <li>
                <span className="num mr-1.5 text-fg-subtle">3.</span>
                行数区间 —— 抓住“垃圾输入返回全市场”这类退化
              </li>
              <li>
                <span className="num mr-1.5 text-fg-subtle">4.</span>
                必需列可解析 —— 由别名注册表完成，失败即报错而非降级
              </li>
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ProvenanceCard({ entry }: { entry: ProvenanceEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = !entry.passed || entry.warnings.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition-colors",
        entry.passed ? "border-line/70" : "border-fail/30 bg-fail-bg",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={cn("num text-[13px]", entry.passed ? "text-pass" : "text-fail")}>
          {entry.passed ? "✓" : "✗"}
        </span>
        <code className="num text-[11.5px] font-medium">{entry.query_id}</code>
        <span className="num text-[11px] text-fg-subtle">
          {fmtInt(entry.row_count)} 行
        </span>
        {entry.warnings.length > 0 ? (
          <Badge tone="warn">{entry.warnings.length} 告警</Badge>
        ) : null}
        {hasIssues ? (
          <button
            type="button"
            onClick={() => setExpanded((previous) => !previous)}
            className="ml-auto text-[11px] text-fg-subtle underline decoration-dotted underline-offset-2 hover:text-fg-muted"
          >
            {expanded ? "收起" : "详情"}
          </button>
        ) : null}
      </div>

      {/* 语义解析结果 —— 本面板的核心内容，始终可见 */}
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

      {expanded ? (
        <div className="animate-rise mt-3 space-y-2 border-t border-line/60 pt-3">
          {entry.violations.map((violation) => (
            <p key={violation} className="text-[11.5px] leading-5 text-fail">
              违约：{violation}
            </p>
          ))}
          {entry.warnings.map((warning) => (
            <p key={warning} className="text-[11.5px] leading-5 text-warn">
              告警：{warning}
            </p>
          ))}
          {/*
            ★ 这里曾经还展示 `skill`（上游的接口标识）与 `trace_id`
            （上游的调用追踪号）。两者都已从快照中移除：站点不公开上游
            身份，而它们对读者也没有价值 —— 要判断的是"这次解析对不对"
            （那是上面的 chunks_info 与违规/告警的职责），
            不是"调用的是哪个接口"。
          */}
        </div>
      ) : null}
    </div>
  );
}
