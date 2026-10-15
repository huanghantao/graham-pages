"use client";

/**
 * 图表组件（客户端）。
 *
 * 为什么不引入图表库
 * ------------------
 * 本项目只需要四种图形：弧线仪表、交互折线、分位条、配置条。
 * ECharts 会带来约 1MB 依赖与全局样式污染；而这几张图的几何逻辑各不到
 * 80 行，手写能获得**完全的控制力**：坐标轴刻度、口径说明、零轴提示
 * 都可以直接画进图里，且配色与设计令牌天然一致。
 *
 * 交互是标配而非可选项：折线图有悬停十字线与浮层、图表有入场动画。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DASH, fmt, fmtInt } from "@/lib/format";

// ── 内部工具 ────────────────────────────────────────────────────────────

/** 线性映射到 [0,1]，并对退化区间（max === min）返回 0.5 而非 NaN。 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/** 温度语义色：冷→绿、中性→琥珀、热→红 */
function thermalVar(t: number): string {
  if (t < 35) return "var(--pass)";
  if (t > 65) return "var(--fail)";
  return "var(--warn)";
}

/** 尊重用户的"减少动态效果"偏好 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduced;
}

/** 数值从 0 动画到目标值（缓出）。用于让"读数"有到来感而非突然出现。 */
function useAnimatedNumber(target: number | null, duration = 900): number | null {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState<number | null>(reduced ? target : null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) {
      setValue(null);
      return;
    }
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutCubic：开始快、结束慢，读数的"落定"感更强
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration, reduced]);

  return value;
}

// ── 弧线仪表（首页主角） ────────────────────────────────────────────────

/**
 * 市场温度弧线仪表。
 *
 * 用 180° 弧线表达 0–100 的温度：左端极冷（便宜、可入），右端极热（昂贵、谨慎）。
 * 指针从 0° 扫到目标角度，配合中心读数的数字滚动，构成首屏的核心视觉。
 *
 * 刻意**不**画成传统温度计形状：水平弧线更容易与下方的仓位建议并排阅读，
 * 且在半圆上判断"偏左/偏右"比在竖直温度计上判断"偏高/偏低"更直观。
 */
export function TemperatureGauge({
  value,
  size = 260,
  label,
}: {
  value: number | null;
  size?: number;
  label?: string;
}) {
  const animated = useAnimatedNumber(value);
  const reduced = usePrefersReducedMotion();

  // 几何：半圆，半径留出描边与刻度空间
  const stroke = 14;
  const radius = (size - stroke * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // 半圆周长 = πr；用 stroke-dasharray 控制已填充部分
  const arcLength = Math.PI * radius;
  const clamped = value === null ? null : Math.max(0, Math.min(100, value));

  const describeArc = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

  return (
    <div className="relative" style={{ width: size, height: size / 2 + 46 }}>
      <svg
        width={size}
        height={size / 2 + 30}
        viewBox={`0 0 ${size} ${size / 2 + 30}`}
        role="img"
        aria-label={value === null ? "温度不可用" : `市场温度 ${value.toFixed(1)}，满分 100`}
      >
        <defs>
          {/* 冷→热的渐变，作为底轨 */}
          <linearGradient id="gauge-track" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--pass)" stopOpacity="0.75" />
            <stop offset="50%" stopColor="var(--warn)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--fail)" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* 底轨 */}
        <path
          d={describeArc}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />

        {/* 已填充部分：用 dashoffset 动画表示扫过的角度 */}
        {clamped !== null ? (
          <path
            d={describeArc}
            fill="none"
            stroke="url(#gauge-track)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={
              reduced ? arcLength * (1 - clamped / 100) : arcLength * (1 - (animated ?? 0) / 100)
            }
          />
        ) : null}

        {/* 端点刻度：0 / 50 / 100 更能锚定"半圆代表什么" */}
        {[0, 50, 100].map((tick) => {
          const angle = Math.PI * (1 - tick / 100);
          const inner = radius - stroke / 2 - 4;
          const outer = radius - stroke / 2 - 11;
          return (
            <line
              key={tick}
              x1={cx + Math.cos(angle) * inner}
              y1={cy - Math.sin(angle) * inner}
              x2={cx + Math.cos(angle) * outer}
              y2={cy - Math.sin(angle) * outer}
              stroke="var(--fg-subtle)"
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.6}
            />
          );
        })}
      </svg>

      {/* 中心读数：绝对定位覆盖在弧线内 */}
      <div className="pointer-events-none absolute inset-x-0 top-[38%] flex flex-col items-center">
        <div
          className="num text-[3.25rem] font-semibold leading-none tracking-tight"
          style={{ color: clamped === null ? "var(--fg-subtle)" : thermalVar(clamped) }}
        >
          {animated === null ? DASH : animated.toFixed(1)}
        </div>
        <div className="mt-1.5 text-[11px] text-fg-subtle">{label ?? "/ 100"}</div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-between px-1 text-[11px] text-fg-subtle">
        <span>极冷 · 便宜</span>
        <span>极热 · 昂贵</span>
      </div>
    </div>
  );
}

// ── 交互折线图 ──────────────────────────────────────────────────────────

export interface LinePoint {
  label: string;
  value: number | null;
}

/**
 * 交互折线图。
 *
 * 功能：悬停显示十字线 + 浮层（期间与精确值）、零轴标注、区间统计、
 * 入场绘制动画。全部为纯 SVG + 指针事件，无第三方依赖。
 *
 * 为什么必须有悬停浮层：财务趋势图的价值在于**读取具体某期的数值**，
 * 而静态图只能看出走势。没有浮层的趋势图是不完整的。
 */
export function LineChart({
  points,
  unit,
  height = 180,
  valueLabel = "值",
  formatValue,
}: {
  points: LinePoint[];
  unit?: string;
  height?: number;
  valueLabel?: string;
  formatValue?: (value: number) => string;
}) {
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const format = formatValue ?? ((value: number) => fmt(value, 2));

  const valid = useMemo(
    () => points.map((point) => point.value).filter((v): v is number => v !== null),
    [points],
  );

  const stats = useMemo(() => {
    if (valid.length === 0) return null;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    // 上下各留 8% 余量，避免极值贴边
    const pad = (max - min || Math.abs(max) || 1) * 0.08;
    return { min: min - pad, max: max + pad, rawMin: min, rawMax: max };
  }, [valid]);

  const W = 720;
  const H = height;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 20;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const x = useCallback(
    (index: number) => padL + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW),
    [innerW, points.length],
  );
  const y = useCallback(
    (value: number) => (stats ? padT + (1 - normalize(value, stats.min, stats.max)) * innerH : padT),
    [innerH, stats],
  );

  const { path, area } = useMemo(() => {
    if (!stats || points.length === 0) return { path: "", area: "" };
    let d = "";
    let started = false;
    points.forEach((point, index) => {
      if (point.value === null) return;
      const px = x(index);
      const py = y(point.value);
      d += started ? ` L ${px.toFixed(2)} ${py.toFixed(2)}` : `M ${px.toFixed(2)} ${py.toFixed(2)}`;
      started = true;
    });
    const baseline = H - padB;
    const areaPath = d ? `${d} L ${x(points.length - 1).toFixed(2)} ${baseline} L ${x(0).toFixed(2)} ${baseline} Z` : "";
    return { path: d, area: areaPath };
  }, [points, stats, x, y, H, padB]);

  /** 指针移动 → 最近数据点索引 */
  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (points.length - 1)));
  };

  if (points.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[13px] text-fg-subtle">
        无序列数据
      </div>
    );
  }

  const active = hover !== null ? points[hover] : null;
  const zeroVisible = stats ? stats.rawMin < 0 : false;

  return (
    <div className="select-none">
      <div
        ref={containerRef}
        className="relative cursor-crosshair"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="line-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--viz-line)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--viz-line)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* 网格：只画 3 条水平线，过多会变成噪声 */}
          {stats
            ? [0, 0.5, 1].map((t) => (
                <line
                  key={t}
                  x1={padL}
                  x2={W - padR}
                  y1={padT + t * innerH}
                  y2={padT + t * innerH}
                  stroke="var(--viz-grid)"
                  strokeWidth={1}
                  opacity={t === 0.5 ? 0.5 : 0.3}
                />
              ))
            : null}

          {/* 零轴：负值区间是判断"是否亏损"的关键基准 */}
          {stats && zeroVisible ? (
            <line
              x1={padL}
              x2={W - padR}
              y1={y(0)}
              y2={y(0)}
              stroke="var(--viz-zero)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ) : null}

          {area ? <path d={area} fill="url(#line-area)" /> : null}

          <path
            d={path}
            fill="none"
            stroke="var(--viz-line)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={
              reduced
                ? undefined
                : {
                    strokeDasharray: 2000,
                    animation: "draw 1.1s cubic-bezier(0.16,1,0.3,1) forwards",
                    ["--dash-len" as string]: 2000,
                  }
            }
          />

          {/* 悬停十字线 + 高亮点 */}
          {hover !== null && active?.value !== null && active?.value !== undefined ? (
            <>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={padT}
                y2={H - padB}
                stroke="var(--fg-subtle)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={x(hover)}
                cy={y(active.value)}
                r={4.5}
                fill="var(--viz-line)"
                stroke="var(--bg-elevated)"
                strokeWidth={2}
              />
            </>
          ) : null}
        </svg>

        {/* 浮层：用 HTML 而非 SVG text，排版更可控 */}
        {hover !== null && active ? (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-lg border border-line-strong bg-bg-elevated px-2.5 py-1.5 shadow-float"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              top: 0,
            }}
          >
            <div className="num text-[13px] font-semibold">
              {active.value === null ? DASH : format(active.value)}
              {unit ? <span className="ml-1 text-[10px] font-normal text-fg-subtle">{unit}</span> : null}
            </div>
            <div className="num text-[10px] text-fg-subtle">{active.label}</div>
          </div>
        ) : null}
      </div>

      {/* 轴标签 + 区间统计 */}
      <div className="num mt-1 flex items-baseline justify-between text-[10px] text-fg-subtle">
        <span>{points[0]?.label}</span>
        {stats ? (
          <span className="text-fg-subtle/80">
            {valueLabel} {points.length} 期 · 区间 {format(stats.rawMin)} ~ {format(stats.rawMax)}
          </span>
        ) : null}
        <span>{points[points.length - 1]?.label}</span>
      </div>

      {zeroVisible ? (
        <p className="mt-1.5 text-[10px] text-fail/80">
          含负值，虚线为零轴 —— 曲线落在虚线下方即为亏损区间
        </p>
      ) : null}
    </div>
  );
}

// ── 分位条 ──────────────────────────────────────────────────────────────

/**
 * 估值分位条。
 *
 * 展示"当前值处于自身历史的什么位置"。分位越靠左越便宜。
 * 悬停任意位置可看该分位对应的**区间端点与中位数** —— 让"37% 分位"
 * 这个抽象数字落到具体数值上。
 */
export function PercentileBar({
  percentile,
  sampleSize,
  current,
  median,
  min,
  max,
  label,
  compact = false,
}: {
  percentile: number | null;
  sampleSize?: number;
  current?: number | null;
  median?: number | null;
  min?: number | null;
  max?: number | null;
  label?: string;
  compact?: boolean;
}) {
  const pct = percentile === null ? null : Math.max(0, Math.min(1, percentile)) * 100;
  const toneVar = pct === null ? "var(--fg-subtle)" : pct < 30 ? "var(--pass)" : pct > 70 ? "var(--fail)" : "var(--warn)";

  if (pct === null) {
    return (
      <div className="text-[11.5px] text-fg-subtle">
        {label ? `${label}：` : ""}样本不足，不输出分位
        <span className="text-fg-subtle/70">（样本太少时“分位”是噪声而非信号）</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        {label ? <span className="text-fg-muted">{label}</span> : <span />}
        <span className="num font-medium" style={{ color: toneVar }}>
          {pct.toFixed(0)}% 分位
          {sampleSize ? (
            <span className="ml-1.5 font-normal text-fg-subtle">
              {fmtInt(sampleSize)} 样本
            </span>
          ) : null}
        </span>
      </div>

      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
        {/* 廉价区 / 昂贵区底色：给出"什么算低"的视觉锚点 */}
        <div className="absolute inset-y-0 left-0 w-[30%] bg-pass/10" />
        <div className="absolute inset-y-0 right-0 w-[30%] bg-fail/10" />
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${pct}%`, background: toneVar }}
        />
        {/* 当前值刻度 */}
        <div
          className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-full bg-fg"
          style={{ left: `calc(${pct}% - 1px)` }}
        />
      </div>

      {!compact && (current !== null || median !== null) ? (
        <div className="num mt-1 flex justify-between text-[10px] text-fg-subtle">
          <span>
            当前 {current === null || current === undefined ? DASH : fmt(current)}
          </span>
          {min !== null && min !== undefined && max !== null && max !== undefined ? (
            <span>
              历史 {fmt(min)} ~ {fmt(max)}
            </span>
          ) : null}
          <span>
            中位 {median === null || median === undefined ? DASH : fmt(median)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ── 配置条（股债仓位） ──────────────────────────────────────────────────

/**
 * 股债配置条。
 *
 * 关键设计：**把原文规定的 25%–75% 区间画成轨道**，用户一眼能看出
 * 当前建议是否落在区间内以及偏向哪一端。这比只显示"75%"信息量大得多 ——
 * 它同时传达了"这个数字有一个不可逾越的上界"。
 */
export function AllocationBar({
  equityWeight,
  band,
  neutral,
}: {
  equityWeight: number | null;
  band: [number, number];
  neutral: number;
}) {
  const pct = equityWeight === null ? null : Math.max(0, Math.min(1, equityWeight)) * 100;
  const [lo, hi] = band;

  return (
    <div>
      <div className="relative h-9 overflow-hidden rounded-lg bg-surface">
        {/* 禁止区：0–25% 与 75–100% 用斜纹表达"越界" */}
        <div
          className="absolute inset-y-0 left-0 bg-fail/8"
          style={{ width: `${lo * 100}%` }}
          aria-hidden
        />
        <div
          className="absolute inset-y-0 right-0 bg-fail/8"
          style={{ width: `${(1 - hi) * 100}%` }}
          aria-hidden
        />
        {/* 允许区边框 */}
        <div
          className="absolute inset-y-0 border-x border-pass/30"
          style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }}
          aria-hidden
        />
        {/* 中位线 50% */}
        <div
          className="absolute inset-y-0 w-px bg-line-strong"
          style={{ left: `${neutral * 100}%` }}
          aria-hidden
        />
        {/* 当前建议 */}
        {pct !== null ? (
          <div
            className="absolute inset-y-0 left-0 flex items-center justify-end rounded-l-lg bg-accent/20 transition-[width] duration-800 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${pct}%` }}
          >
            <div className="h-full w-[3px] rounded-full bg-accent" />
          </div>
        ) : null}
      </div>

      <div className="num mt-1.5 flex justify-between text-[10px] text-fg-subtle">
        <span>0%</span>
        <span className="text-fail/70">{(lo * 100).toFixed(0)}% 原文下限</span>
        <span>{(neutral * 100).toFixed(0)}%</span>
        <span className="text-fail/70">{(hi * 100).toFixed(0)}% 原文上限</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// ── 微型柱状图 ──────────────────────────────────────────────────────────

/** 迷你柱状图。用于评分分项等"若干小数值"的紧凑呈现。 */
export function MiniBars({
  items,
  max = 100,
}: {
  items: { label: string; value: number | null }[];
  max?: number;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = item.value === null ? null : Math.max(0, Math.min(1, item.value / max));
        const toneVar =
          pct === null ? "var(--line-strong)" : pct >= 0.6 ? "var(--pass)" : pct >= 0.35 ? "var(--warn)" : "var(--fail)";
        return (
          <div key={item.label} className="flex items-center gap-2.5">
            <span className="w-20 shrink-0 truncate text-[11.5px] text-fg-muted" title={item.label}>
              {item.label}
            </span>
            <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface">
              {pct !== null ? (
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${pct * 100}%`, background: toneVar }}
                />
              ) : null}
            </div>
            <span className="num w-11 shrink-0 text-right text-[11.5px] font-medium">
              {item.value === null ? DASH : item.value.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
