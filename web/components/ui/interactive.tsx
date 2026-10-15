"use client";

/**
 * 交互组件（客户端）。
 *
 * 本应用绝大多数内容是静态展示，因此交互组件被严格限制在这几类：
 * 分段控件、标签页、气泡提示、滑出面板、可复制文本。
 *
 * 实现上刻意不引入任何 UI 库：
 * - 动画用 CSS transform（GPU 合成，不触发布局）；
 * - 标签指示条用真实测量而非等宽假设，因此标签长度可自由变化；
 * - 无障碍：键盘可达、`aria-*` 完整、Esc 可关闭。
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/cn";

import { Portal } from "./portal";

// ── 分段控件 ────────────────────────────────────────────────────────────

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * 分段控件（segmented control）。
 *
 * 用等宽网格 + 单一滑块实现：滑块位置由 `translateX(index * 100%)` 计算，
 * 因此切换是纯 GPU 变换，不会引起重排 —— 这是"即时响应"观感的来源。
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  columns,
  className,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: "sm" | "md";
  /** 强制列数（如移动端用 2 列换行，而不是挤成一长条）。默认按选项数均分。 */
  columns?: number;
  className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      role="tablist"
      className={cn(
        "relative grid rounded-lg border border-line/70 bg-surface p-0.5",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))`,
      }}
    >
      {/* 滑块：仅单行时可用（多行布局下滑块位置需要二维计算，得不偿失，
          因此多行时改用背景高亮表达选中态） */}
      {!columns || columns >= options.length ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-[7px] bg-bg-elevated shadow-card transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            width: `calc((100% - 4px) / ${options.length})`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 rounded-[7px] font-medium transition-colors duration-150",
              size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
              active
                ? columns && columns < options.length
                  ? "bg-bg-elevated text-fg shadow-card"
                  : "text-fg"
                : "text-fg-subtle hover:text-fg-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ── 标签页 ──────────────────────────────────────────────────────────────

/**
 * 标签页。
 *
 * 指示条位置由**真实测量**得到（`getBoundingClientRect`），因此标签宽度
 * 可以自由不同 —— 比"等宽假设"更稳健。窗口尺寸变化时重新测量。
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  trailing,
}: {
  tabs: readonly { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  trailing?: React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (!active) return;
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  }, []);

  useLayoutEffect(() => {
    measure();
    // 字体加载完成后尺寸会变，需重新测量。
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, value]);

  return (
    <div className={cn("relative border-b border-line/70", className)}>
      <div ref={listRef} className="flex items-center gap-1 overflow-x-auto" role="tablist">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              data-active={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                "relative whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors duration-150",
                active ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
              )}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 ? (
                <span className="num ml-1.5 rounded bg-surface px-1 py-px text-[10px] text-fg-subtle">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
        {trailing ? <div className="ml-auto pl-3">{trailing}</div> : null}
      </div>
      {indicator ? (
        <span
          aria-hidden
          className="absolute -bottom-px h-0.5 rounded-full bg-fg transition-[transform,width] duration-280 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        />
      ) : null}
    </div>
  );
}

// ── 气泡提示 ────────────────────────────────────────────────────────────

/**
 * 气泡提示。
 *
 * 用真实浮层代替 HTML `title`：后者有 1 秒延迟、样式不可控、触屏不可用。
 * 本应用大量需要"值不适用时说明原因"，浮层是必需品而非装饰。
 */
export function Tip({
  content,
  children,
  side = "top",
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    // 120ms 延迟：避免鼠标扫过时连环弹窗造成干扰。
    timer.current = setTimeout(() => setOpen(true), 120);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={() => setOpen(true)}
      onBlur={hide}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "animate-rise pointer-events-none absolute left-1/2 z-50 w-max max-w-[19rem] -translate-x-1/2 rounded-lg border border-line-strong bg-bg-elevated px-2.5 py-2 text-[12px] leading-5 text-fg shadow-float",
            side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

// ── 滑出面板 ────────────────────────────────────────────────────────────

/**
 * 滑出面板（slide-over）。
 *
 * 用途：在筛选器里点一行不必离开当前页就能看详情（保持筛选状态与滚动位置），
 * 这是"不打断用户上下文"的关键交互。
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // 锁滚动，避免背景跟着滚。
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity"
      />
      <div className="animate-rise absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-line bg-bg shadow-modal">
        <header className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-tight">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 text-xs text-fg-subtle">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line/70 px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-hover"
          >
            Esc 关闭
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="border-t border-line/70 px-5 py-3.5">{footer}</footer>
        ) : null}
        </div>
      </div>
    </Portal>
  );
}
  // ── 复制 ────────────────────────────────────────────────────────────────

/**
 * 可复制文本。用于溯源面板里的接口标识与调用追踪号。
 *
 * ★ 那些字段**只在工作台档案下存在**（公开档案整键抹除），因此这个组件由
 * 调用方按"字段是否存在"决定要不要渲染 —— 见 `panels/provenance.tsx`。
 * 换句话说：披露与否由**数据**决定，界面不需要知道任何厂商名，
 * 公开仓库的源码里也就不会出现它。
 */
export function Copyable({
  value,
  children,
  className,
}: {
  value: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // 剪贴板不可用（如非 HTTPS）时静默失败：不是关键路径。
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="点击复制"
      className={cn(
        "num group inline-flex items-center gap-1.5 rounded-md border border-transparent px-1 py-0.5 text-left text-[11.5px] text-fg-subtle transition-colors hover:border-line hover:bg-surface hover:text-fg-muted",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children ?? value}</span>
      <span
        className={cn(
          "shrink-0 text-[10px]",
          copied ? "text-pass" : "opacity-0 group-hover:opacity-60",
        )}
      >
        {copied ? "已复制" : "复制"}
      </span>
    </button>
  );
}
