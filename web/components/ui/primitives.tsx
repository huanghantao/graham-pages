/**
 * 基础展示组件（服务端组件，零客户端 JS）。
 *
 * 视觉原则：
 * - 用**分层表面**（页面背景 → 卡片 → 卡片内高亮）而非重边框来建立层级；
 * - 圆角统一 12–16px，边框透明度低（现代 UI 的"轻"来自这里）；
 * - 留白比旧版大一档（p-5/p-6），信息密度靠**排版层级**而非挤在一起实现；
 * - 语义色只用于表达判断（通过/失败/警示），不用于装饰。
 */

import Link from "next/link";

import { cn } from "@/lib/cn";

// ── 容器 ────────────────────────────────────────────────────────────────

export function Card({
  children,
  className,
  id,
  as: Tag = "section",
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * 锚点 id。
   *
   * 需要它是因为「目录跳转」这类页内导航靠原生 `#anchor` 实现 ——
   * 不依赖 JS，且分享/收藏某个锚点能直接定位。
   * 配合 `scroll-mt-*` 使用：顶部导航是 sticky 的，
   * 没有 `scroll-mt` 时跳转后标题会被导航盖住。
   */
  id?: string;
  as?: "section" | "div" | "article" | "aside";
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "rounded-2xl border border-line/70 bg-bg-elevated shadow-card",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** 卡片内的标准内边距容器 */
export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5 sm:p-6", className)}>{children}</div>;
}

/**
 * 卡片标题栏。
 *
 * `micro` 标签用于字段名（小号大写宽字距），主标题用常规字重 ——
 * 这种"微标签 + 大内容"的对比是现代数据界面的核心排版手法。
 */
export function CardHeader({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 px-5 pt-5 sm:px-6 sm:pt-6",
        className,
      )}
    >
      <h2 className="text-[15px] font-semibold tracking-tight">
        {title}
        {hint ? (
          <span className="ml-2.5 text-xs font-normal text-fg-subtle">{hint}</span>
        ) : null}
      </h2>
      {action}
    </div>
  );
}

// ── 标签 ────────────────────────────────────────────────────────────────

type Tone = "neutral" | "pass" | "fail" | "warn" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-line-strong/60 bg-surface text-fg-muted",
  pass: "border-pass/30 bg-pass-bg text-pass",
  fail: "border-fail/30 bg-fail-bg text-fail",
  warn: "border-warn/30 bg-warn-bg text-warn",
  accent: "border-accent/30 bg-accent-bg text-accent",
};

/** 徽标。用于象限、严重度、状态等短标签。 */
export function Badge({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** 状态点（比徽标更轻，用于表格内） */
export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const color: Record<Tone, string> = {
    neutral: "bg-muted-mark",
    pass: "bg-pass",
    fail: "bg-fail",
    warn: "bg-warn",
    accent: "bg-accent",
  };
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", color[tone])} />;
}

// ── 数字展示 ────────────────────────────────────────────────────────────

/**
 * 指标块：微标签 + 大数字 + 可选副标题。
 *
 * 这是本应用出现频率最高的组件。它的层级设计决定了整站的观感：
 * 数值用 `text-2xl/3xl` + 等宽，标签用小号弱色 —— 让眼睛先看到数字。
 */
export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  size = "md",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: Tone;
  size?: "sm" | "md" | "lg" | "xl";
  icon?: React.ReactNode;
}) {
  const toneClass: Record<Tone, string> = {
    neutral: "text-fg",
    pass: "text-pass",
    fail: "text-fail",
    warn: "text-warn",
    accent: "text-accent",
  };
  const sizeClass = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-[2rem] leading-none",
    xl: "text-[2.75rem] leading-none",
  }[size];

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="micro">{label}</span>
        {icon}
      </div>
      <div className={cn("num mt-1.5 font-semibold tracking-tight", sizeClass, toneClass[tone])}>
        {value}
        {unit ? (
          <span className="ml-1 text-xs font-normal text-fg-subtle">{unit}</span>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] leading-4 text-fg-subtle">{hint}</div>
      ) : null}
    </div>
  );
}

/** 定义行（标签 : 值）。用于紧凑的键值展示。 */
export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2", className)}>
      <span className="shrink-0 text-[13px] text-fg-muted" title={hint}>
        {label}
      </span>
      <span className="num min-w-0 text-right text-[13px] font-medium">{children}</span>
    </div>
  );
}

/** 行分隔（比边框更轻，用于列表内） */
export function RowDivider() {
  return <div className="h-px bg-line/70" />;
}

// ── 说明与提示 ──────────────────────────────────────────────────────────

/**
 * 提示条。
 *
 * 用于承载"方法论说明 / 已知局限 / 数据告警" —— 本应用大量需要这类内容，
 * 且它们的语气必须与正文区分（说明性 vs 结论性）。
 */
export function Notice({
  tone = "neutral",
  title,
  children,
  icon,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  const toneClass: Record<Tone, string> = {
    neutral: "border-line/70 bg-surface text-fg-muted",
    pass: "border-pass/25 bg-pass-bg text-fg-muted",
    fail: "border-fail/25 bg-fail-bg text-fg-muted",
    warn: "border-warn/25 bg-warn-bg text-fg-muted",
    accent: "border-accent/25 bg-accent-bg text-fg-muted",
  };
  const titleTone: Record<Tone, string> = {
    neutral: "text-fg",
    pass: "text-pass",
    fail: "text-fail",
    warn: "text-warn",
    accent: "text-accent",
  };
  return (
    <div className={cn("rounded-xl border p-3.5 text-[13px] leading-relaxed", toneClass[tone], className)}>
      {title ? (
        <div className={cn("mb-1 flex items-center gap-1.5 text-xs font-semibold", titleTone[tone])}>
          {icon}
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** 项目符号列表（弱化样式，用于说明性内容） */
export function Bullets({
  items,
  tone = "neutral",
  className,
}: {
  items: readonly React.ReactNode[];
  tone?: "neutral" | "warn";
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul
      className={cn(
        "space-y-1.5 text-[12px] leading-5",
        tone === "warn" ? "text-warn" : "text-fg-subtle",
        className,
      )}
    >
      {items.map((item, index) => (
        <li key={index} className="flex gap-2">
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-current opacity-50" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── 空态与骨架 ──────────────────────────────────────────────────────────

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-fg-subtle">{icon}</div> : null}
      <p className="text-[15px] font-medium">{title}</p>
      {hint ? (
        <div className="mt-1.5 max-w-md text-[13px] leading-6 text-fg-subtle">{hint}</div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/** 代码片段。用于展示查询语句、契约标识等。 */
export function Code({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        "num rounded-md border border-line/70 bg-surface px-1.5 py-0.5 text-[11.5px] text-fg-muted",
        className,
      )}
    >
      {children}
    </code>
  );
}

/** 链接按钮（内联样式，用于卡片底部的跳转） */
export function InlineLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1 text-[13px] font-medium text-accent transition-opacity hover:opacity-80",
        className,
      )}
    >
      {children}
      <span className="transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  );
}
