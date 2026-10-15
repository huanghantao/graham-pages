"use client";

/**
 * 个股结论栏（粘性）。
 *
 * 这是个股页体验的核心：**滚动到任何位置都能看到结论**。
 *
 * 旧版把结论放在页面顶部，用户一旦往下滚去读判据或趋势，就再也看不到
 * 安全边际是多少 —— 这是最影响使用体验的设计缺陷。粘性栏解决它：
 * 始终可见，且滚过标题后自动收紧（节省垂直空间）。
 *
 * 交互：
 * - 安全边际分数用环形进度表达，鼠标悬停可看扣分明细；
 * - "不适用"的状态用颜色 + 图标区分，不显示为空白。
 */

import { useEffect, useState } from "react";

import { Badge, Tip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DASH, fmt, fmtInt, fmtRatio } from "@/lib/format";
import type { MarginOfSafety, Quadrant, ScoreRow } from "@/lib/types";

const QUADRANT_META: Record<Quadrant, { label: string; tone: "pass" | "warn" | "fail" | "neutral" | "accent" }> = {
  cheap_good: { label: "便宜且好", tone: "pass" },
  cheap_poor: { label: "便宜但差", tone: "warn" },
  rich_good: { label: "好但贵", tone: "accent" },
  rich_poor: { label: "贵且差", tone: "fail" },
  unscorable: { label: "无法评分", tone: "neutral" },
};

/** 环形分数。用 stroke-dashoffset 表达 0–100，颜色随分数变化。 */
function ScoreRing({ value, size = 52 }: { value: number | null; size?: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  const tone =
    value === null ? "var(--fg-subtle)" : value >= 50 ? "var(--pass)" : "var(--fail)";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--line)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
      />
    </svg>
  );
}

export function ConclusionBar({
  name,
  code,
  market,
  industry,
  asOf,
  score,
  margin,
  riskCount,
}: {
  name: string;
  code: string;
  market: string;
  industry: string | null;
  asOf: string | null;
  score: ScoreRow | null;
  margin: MarginOfSafety | null;
  riskCount: number;
}) {
  const [compact, setCompact] = useState(false);

  // 滚过标题区后收紧，节省垂直空间
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const quadrant = score ? QUADRANT_META[score.quadrant] : QUADRANT_META.unscorable;

  return (
    <div
      className={cn(
        "sticky top-[53px] z-40 -mx-4 border-b border-line/70 bg-bg/92 px-4 backdrop-blur-xl transition-all duration-300 sm:-mx-6 sm:px-6",
        compact ? "py-2" : "py-3 sm:py-4",
      )}
    >
      {/*
        移动端布局：标题与分数环同一行（必须一眼看到结论），
        分解指标另起一行并允许横向滚动 —— 换行会让粘性栏变高，
        挤压本就不多的内容区。
      */}
      {/*
        移动端用 flex-col 显式堆叠两行。
        曾经的写法是外层 flex-wrap + 指标行 w-full，但 flex-1 的
        flex-basis 是 0%、而 w-full 的 flex-basis 是 100%，两者**刚好凑满 100%**，
        于是 flexbox 把它们放在同一行并互相重叠 —— 实测「便宜度 100.0」
        与「便宜但差」徽标完全重叠、都无法阅读。
        显式列布局不会再有这种隐式计算带来的意外。
      */}
      <div className="mx-auto flex max-w-[80rem] flex-col gap-y-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
        <div className="flex min-w-0 items-center gap-2.5 sm:flex-1 sm:gap-3">
          <div className="relative shrink-0">
            <ScoreRing value={score?.mos ?? null} size={compact ? 40 : 46} />
            <span
              className="num absolute inset-0 grid place-items-center text-[12px] font-semibold sm:text-[13px]"
              style={{
                color:
                  score?.mos == null
                    ? "var(--fg-subtle)"
                    : score.mos >= 50
                      ? "var(--pass)"
                      : "var(--fail)",
              }}
            >
              {score?.mos == null ? DASH : score.mos.toFixed(0)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              {/*
                ★ 用 `h1` 而非 `span`：个股页是全站唯一没有一级标题的页面，
                而它是站内最重要的详情页。缺 `h1` 会让屏幕阅读器用户
                无法定位"本页主题"，也无法按标题快速跳转。
                视觉样式与原来完全一致 —— 只改语义标签，不改外观。
              */}
              <h1
                className={cn(
                  "truncate font-semibold tracking-tight",
                  compact ? "text-[14px]" : "text-[15px] sm:text-[17px]",
                )}
              >
                {name}
              </h1>
              <span className="num hidden text-[11.5px] text-fg-subtle sm:inline">{code}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={quadrant.tone}>{quadrant.label}</Badge>
              <span className="num text-[10.5px] text-fg-subtle sm:hidden">{code}</span>
              <span className="hidden text-[11px] text-fg-subtle sm:inline">
                {market}
                {industry ? ` · ${industry}` : ""}
                {asOf ? ` · ${asOf}` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* 分解指标：移动端横向滚动（窄屏放不下时滑动，而不是挤压换行），
            桌面端平铺。 */}
        <div className="-mx-4 flex shrink-0 items-center gap-x-5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:w-auto sm:gap-x-6 sm:overflow-visible sm:px-0">
          <Tip
            content={
              margin?.cheapness == null
                ? "便宜度不可用：亏损公司或数据不足，符号守卫拒绝评分"
                : "估值分位 40% + 绝对估值 25% + 股息率 20% + NCAV 折价 15%"
            }
          >
            <MiniStat
              label="便宜度"
              value={margin?.cheapness ?? null}
              digits={1}
            />
          </Tip>
          <Tip content="盈利稳定性 30% + 财务稳健 25% + 现金流质量 25% + 回报质量 20%">
            <MiniStat label="质量度" value={margin?.quality ?? null} digits={1} />
          </Tip>
          <Tip
            content={
              score
                ? `数据覆盖率 ${fmtRatio(score.coverage)}。低于 60% 时不输出总分，但仍完整展示判据。`
                : "无评分数据"
            }
          >
            <MiniStat
              label="覆盖率"
              value={score ? score.coverage * 100 : null}
              digits={0}
              suffix="%"
            />
          </Tip>
          {riskCount > 0 ? (
            <Tip content="命中监管或财务异常信号，详见「风险」标签页">
              <span className="flex items-center gap-1.5">
                <span className="micro">雷区</span>
                <span className="num text-[13px] font-semibold text-fail">{fmtInt(riskCount)}</span>
              </span>
            </Tip>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  digits,
  suffix,
}: {
  label: string;
  value: number | null;
  digits: number;
  suffix?: string;
}) {
  const tone =
    value === null ? "var(--fg-subtle)" : value >= 50 ? "var(--pass)" : "var(--fail)";
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="micro">{label}</span>
      <span className="num text-[14px] font-semibold" style={{ color: tone }}>
        {value === null ? DASH : `${fmt(value, digits)}${suffix ?? ""}`}
      </span>
    </span>
  );
}
