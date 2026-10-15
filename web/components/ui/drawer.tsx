"use client";

/**
 * 移动端底部抽屉（bottom sheet）。
 *
 * 为什么是底部而非侧边：手机上方的可视区域最宝贵，底部是拇指自然可达区。
 * 筛选条件属于「配置」而非「内容」，放到从底部升起的抽屉里，
 * 关闭后内容区完全不被占用 —— 这比让侧栏堆叠到内容上方好得多
 * （后者会把结果推到屏幕外，用户每次改条件都要重新滚动）。
 *
 * 交互细节：
 * - 支持向下拖拽关闭（指针事件，无需手势库）；
 * - 背景遮罩点击关闭、Esc 关闭；
 * - 打开时锁定 body 滚动，避免背景跟着滚。
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { Portal } from "./portal";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  // 关闭时重置拖拽位移，避免下次打开时抽屉停在半空
  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    startY.current = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (startY.current === null) return;
    const delta = event.clientY - startY.current;
    // 只允许向下拖；向上拖不产生位移（避免与内部滚动冲突）
    setDragY(Math.max(0, delta));
  }, []);

  const onPointerUp = useCallback(() => {
    // 拖过 96px 视为关闭意图
    if (dragY > 96) onClose();
    setDragY(0);
    startY.current = null;
  }, [dragY, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[65]" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <div
        className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-line bg-bg-elevated shadow-modal lg:hidden"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? "none" : "transform 260ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* 拖拽把手 —— 同时是"可以下滑关闭"的可视提示 */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="h-1 w-9 rounded-full bg-line-strong" />
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-line/70 px-5 pb-3">
          <span className="text-[15px] font-semibold tracking-tight">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line/70 px-2.5 py-1 text-[12px] text-fg-muted transition-colors hover:bg-surface-hover"
          >
            完成
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-line/70 px-5 py-3">{footer}</div>
        ) : null}
        </div>
      </div>
    </Portal>
  );
}

/**
 * 移动端浮动操作按钮。
 *
 * 用于触发筛选抽屉。带激活条件计数徽标 —— 用户合上抽屉后仍需知道
 * "当前有条件生效"，否则会以为列表是全集。
 */
export function FloatingFilterButton({
  count,
  onClick,
  label = "筛选",
}: {
  count: number;
  onClick: () => void;
  label?: string;
}) {
  return (
    // 必须经 Portal：它用 position:fixed 定位到视口，而本应用页面容器
    // 普遍带 animate-rise（transform 动画会建立包含块），
    // 不挂到 body 就会把按钮定位到文档末尾（实测 y=47390）。
    <Portal>
      <button
        type="button"
        onClick={onClick}
      className={cn(
        "fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border px-4 py-3 text-[13px] font-medium shadow-float transition-colors lg:hidden",
        count > 0
          ? "border-accent/40 bg-accent text-white"
          : "border-line-strong bg-bg-elevated text-fg",
      )}
        aria-label={count > 0 ? `${label}（${count} 个条件生效）` : label}
      >
        <span aria-hidden>⚙</span>
        {label}
        {count > 0 ? (
          <span className="num grid size-5 place-items-center rounded-full bg-white/25 text-[11px]">
            {count}
          </span>
        ) : null}
      </button>
    </Portal>
  );
}
