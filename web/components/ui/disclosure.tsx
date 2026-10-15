"use client";

/**
 * 可折叠区块（disclosure）。
 *
 * ## 为什么需要它
 *
 * 本站多个页面把「解释性内容」和「数据内容」平铺在同一个滚动流里，
 * 于是用户要先滚过解释才能看到数据：
 *
 * * 基金页：三张说明卡占 1,707px（手机 2 屏）才轮到第一张榜；
 * * 数据健康页：88 条诊断明细默认展开，把后面的结论推到 4,998px 处；
 * * 方法论页：7 条准则 + 纪律声明 + 契约表 = 12 屏，且没有目录。
 *
 * 这些解释**必须存在**（本站的原则是不隐藏口径与局限），
 * 但不该挡在数据前面。折叠让两者都满足：
 * 默认收起、标题始终可见、点开即读。
 *
 * ## 为什么用 `<details>` 而不是自建状态
 *
 * 原生 `<details>`/`<summary>` 自带浏览器行为：键盘可聚焦、
 * 屏幕阅读器会播报展开状态、`Ctrl+F` 能搜到折叠内的文字
 * （浏览器会自动展开匹配项）。自建折叠需要重新实现这三件事，
 * 而且很难做对 —— 这里没有理由不用原生元素。
 *
 * 只在需要跟随「主题色/间距」时加样式，不覆盖交互语义。
 */

import { cn } from "@/lib/cn";

export function Disclosure({
  summary,
  hint,
  children,
  defaultOpen = false,
  tone = "default",
  className,
}: {
  /** 折叠标题（始终可见）。 */
  summary: string;
  /** 标题旁的小字说明。 */
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** ``muted`` 用于次要内容（如诊断明细）。 */
  tone?: "default" | "muted";
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-xl border border-line/70 bg-bg-elevated shadow-card",
        className,
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-baseline justify-between gap-3 px-4 py-3",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          {/* 指示三角：旋转 90° 表示展开。用纯 CSS，不依赖 JS 状态。 */}
          <span
            aria-hidden
            className="inline-block shrink-0 text-[10px] text-fg-subtle transition-transform group-open:rotate-90"
          >
            ▶
          </span>
          <span
            className={cn(
              "truncate font-semibold tracking-tight",
              tone === "muted" ? "text-[12.5px] text-fg-muted" : "text-[13.5px]",
            )}
          >
            {summary}
          </span>
        </span>
        {hint ? (
          <span className="shrink-0 text-[11px] text-fg-subtle">{hint}</span>
        ) : null}
      </summary>
      <div className="border-t border-line/70 px-4 py-3.5">{children}</div>
    </details>
  );
}
