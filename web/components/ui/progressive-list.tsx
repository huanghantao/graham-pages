"use client";

/**
 * 渐进加载：先渲染一批，用户要更多时再追加。
 *
 * ## 为什么必须做
 *
 * 筛选器一次载入 268 条并在**首屏全部渲染**。手机上实测文档高度
 * **79,154px —— 相当于 93 屏**，桌面端也有 25 屏。
 * 后果不只是"长"：
 *
 * * 首屏渲染 268 张卡片（每张约 295px），滚动明显卡顿；
 * * 用户无法判断"到底有多少条、我滚到哪了"；
 * * 手机上滚到底部要滑几十次 —— 而真正需要的往往就是前几十条
 *   （结果已按安全边际降序）。
 *
 * ## 为什么用「渐进加载」而不是「虚拟滚动」
 *
 * 虚拟滚动（只渲染视口内的行）性能更好，但会引入几个新问题：
 * 高度估算不准导致滚动条跳动、浏览器 Ctrl+F 找不到未渲染内容、
 * 打印与无障碍遍历失效。本站的排序质量高、用户主要看前几十条，
 * 因此"先给一批、要更多再给"在收益与复杂度之间更划算 ——
 * 也是这个页面真正需要的行为（看榜，不是通览全表）。
 *
 * 与基金榜的「显示更多」保持一致：同一产品里同类交互应当相同。
 */

import { useEffect, useState } from "react";

import { fmtInt } from "@/lib/format";

//: 首屏渲染条数。
//:
//: 取 40：手机上约 12 屏（每屏 3~4 张卡片），足够形成"榜"的观感，
//: 又不至于让首屏渲染变慢。桌面表格一屏约 15 行，40 行约 2.7 屏。
const INITIAL = 40;

//: 每次追加的条数。
const STEP = 40;

export function ProgressiveList<T>({
  items,
  render,
  unit = "条",
  resetKey,
}: {
  items: T[];
  render: (visible: T[]) => React.ReactNode;
  /** 量词（"条"/"只"）。 */
  unit?: string;
  /** 变化时重置展开进度 —— 筛选条件改了之后应回到首屏。 */
  resetKey?: string;
}) {
  const [limit, setLimit] = useState(INITIAL);

  // 筛选条件变化时收起，否则用户改完条件会停在上一次的展开位置，
  // 看到的是"第一次筛选的第 200 条"，而不是新结果的前 40 条。
  useEffect(() => {
    setLimit(INITIAL);
  }, [resetKey]);

  const visible = items.slice(0, limit);
  const remaining = items.length - visible.length;

  return (
    <>
      {render(visible)}
      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setLimit((value) => value + STEP)}
          className="mt-3 w-full rounded-lg border border-line/70 py-2.5 text-[12.5px] text-fg-muted transition-colors hover:bg-surface"
        >
          显示更多（还有 {fmtInt(remaining)} {unit}）
        </button>
      ) : items.length > INITIAL ? (
        <p className="mt-3 text-center text-[11.5px] text-fg-subtle">
          已显示全部 {fmtInt(items.length)} {unit}
        </p>
      ) : null}
    </>
  );
}
