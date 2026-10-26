"use client";

/**
 * 基金榜的类别切换。
 *
 * ## 为什么必须切换而不是继续堆叠
 *
 * 基金类别 + ETF 原先垂直堆叠，手机端实测 **48.6 屏**：
 * 想看「中长期纯债」要先滚过 22,000px（26 屏）。
 * 类别扩到七类之后，堆叠方案会变成 80 屏以上 —— 切换不是优化，是唯一可用形态。
 *
 * ## 更重要的原因：堆叠会诱导一个**错误比较**
 *
 * 本站模型的核心主张是「分数只在本类别内可比」——
 * 纯债榜首的 97 分不等于它比偏股榜首的 92 分更值得买，
 * 因为「年化 5%」对纯债是优秀、对偏股是平庸。
 *
 * 但把四张榜纵向排开，用户滚动时**天然会横向比分数**
 * （尤其相邻两张榜的榜首都在视野附近时）。也就是说：
 * 堆叠不只是不好用，它在**结构上鼓励**一个模型明确反对的比较。
 *
 * 改成切换后，同一时刻只有一个类别在视野里 ——
 * 错误比较从"需要用户自觉避免"变成"结构上不可能发生"。
 * 这比在页面上再写一段警示文字有效得多。
 *
 * ## URL 同步
 *
 * 当前类别写进 `?c=`，换取三件事：可分享、可收藏、刷新后停在原地。
 * 用 `history.replaceState` 而非 `router.push`：
 * 切换标签是「同一页面的视图切换」而不是导航，
 * 不该产生历史记录（否则按后退键会在标签间来回跳），
 * 也不该触发服务端重新取数。
 */

import { useEffect, useState } from "react";

import { EtfTable } from "./etf-table";
import { FundTable } from "./fund-table";
import type { EtfRow, FundFactorSpec, FundGroup } from "@/lib/types";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";

/** ETF 标签的内部键。刻意不与基金类别枚举冲突。 */
const ETF_KEY = "etf";

interface Tab {
  key: string;
  label: string;
  count: number;
  /** 一句话说明这类基金是什么 —— 切换标签时同步更新，帮助理解当前在看什么。 */
  note: string;
}

export function FundTabs({
  groups,
  factors,
  etfs,
  universe,
  initialKey,
}: {
  groups: FundGroup[];
  factors: FundFactorSpec[];
  etfs: EtfRow[];
  universe: number;
  initialKey: string;
}) {
  const tabs: Tab[] = [
    ...groups.map((group) => ({
      key: group.category,
      label: group.label,
      count: group.count,
      // 说明由服务端按类别下发（`FundGroup.note`）。前端硬编码那张表
      // 在新增类别时会静默留下一行空白说明 —— 而空白看起来像是"这类没有备注"。
      note: group.note,
    })),
    {
      key: ETF_KEY,
      label: "低成本指数",
      count: etfs.length,
      note: "按跟踪指数分组，同一指数下比管理费率 —— 费率是长期收益最确定的那个变量。",
    },
  ];

  //: 默认标签的 key（即第一个标签）。抽成独立变量是为了得到**稳定的依赖值**：
  //: `tabs` 每次渲染都是新数组，直接放进 useEffect 依赖会让下面的 URL 同步
  //: **每次渲染都重跑**（replaceState 是幂等的，所以症状只是白跑，但每次
  //: 渲染都改写地址栏并非无害 —— 它会干扰浏览器的滚动恢复与前进后退语义）。
  const defaultKey = tabs[0]?.key;

  const [active, setActive] = useState(
    tabs.some((tab) => tab.key === initialKey) ? initialKey : (defaultKey ?? ""),
  );

  /**
   * 挂载后从 URL 读一次 `?c=`。
   *
   * 静态导出的页面上没有服务端可以读查询参数，因此 `initialKey` 恒为空，
   * 只能在这里补。★ 这一步**不能省**：下面的 URL 同步会在 active 等于
   * 默认标签时把 `c` 参数删掉 —— 不先读一次，用户带 `?c=` 打开分享链接
   * 会看到默认标签，而地址栏里的参数被静默抹掉。
   *
   * 只在挂载时跑一次（依赖为空）：之后标签由用户点击驱动，
   * 再读 URL 会把用户的选择覆盖回地址栏里的旧值。
   */
  useEffect(() => {
    if (initialKey) return; // 服务端已给定（非静态部署时）
    const requested = new URLSearchParams(window.location.search).get("c");
    if (requested && tabs.some((tab) => tab.key === requested)) {
      setActive(requested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时执行一次
  }, []);

  // URL 同步：只在客户端执行，且不触发导航（见文件头说明）。
  useEffect(() => {
    if (!active) return;
    const url = new URL(window.location.href);
    // 第一个标签视为默认值，不写进 URL —— 保持地址干净，
    // 也让「无参数」与「显式指定第一个标签」指向同一页。
    if (active === defaultKey) url.searchParams.delete("c");
    else url.searchParams.set("c", active);
    window.history.replaceState(null, "", url.toString());
  }, [active, defaultKey]);

  const first = tabs[0];
  if (first === undefined) return null; // 无任何类别（快照为空）
  const current = tabs.find((tab) => tab.key === active) ?? first;

  return (
    <div className="space-y-3">
      {/*
        类别切换。

        ## 为什么用「换行网格」而不是横向滚动条

        首版做成横向可滚动的单行（带 mask 渐隐提示）。但实测手机端
        5 个标签总宽 511px / 视口 393px，**「短期纯债」与「低成本指数」
        被挤到屏幕外** —— 而这恰恰是两个重要入口（短债是现金管理主力，
        低成本指数是全站的兜底方案）。

        标签切换是这个页面的**一级导航**，不是次要操作。让一级导航
        需要横向滑动才能发现，是拿可用性换整洁 —— 尤其"低成本指数"
        完全藏在屏幕外，用户根本不知道它存在。

        改为 `grid` 自动换行：手机两列、平板四列、桌面八列 ——
        七类基金 + ETF 在桌面正好铺满一行，任何尺寸下都不需要横向滚动。

        ★ 列数随标签数量调整过：原先写死 `lg:grid-cols-5`，
        加到 8 个标签后会折成 5 + 3 两行，最后一行只占一半宽度，
        视觉上像是"标签没排完"。
      */}
      <div
        role="tablist"
        aria-label="基金类别"
        className="grid grid-cols-2 gap-1 rounded-xl border border-line/70 bg-bg-elevated p-1 shadow-card sm:grid-cols-4 lg:grid-cols-8"
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.key)}
              className={cn(
                "flex min-w-0 items-baseline justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors",
                selected
                  ? "bg-surface text-fg shadow-card"
                  : "text-fg-subtle hover:text-fg-muted",
              )}
            >
              <span className="truncate">{tab.label}</span>
              <span
                className={cn(
                  "num shrink-0 text-[10.5px] tabular-nums",
                  selected ? "text-fg-muted" : "text-fg-subtle opacity-70",
                )}
              >
                {fmtInt(tab.count)}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        当前类别的定位说明。
        切换标签时同步更新，回答"我现在看的是哪一类、它适合谁" ——
        否则用户只看到一串代码与分数，不知道自己是否看对了类别。
      */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11.5px] leading-5">
        <p className="text-fg-muted">
          <strong className="text-fg">{current.label}</strong>
          {`：${current.note}`}
        </p>
        <p className="text-fg-subtle">
          分数只在本类别内可比 —— 跨类别的分数不做对照。
        </p>
      </div>

      {active === ETF_KEY ? (
        <EtfTable etfs={etfs} />
      ) : (
        (() => {
          const group = groups.find((item) => item.category === active);
          if (!group) return null;
          return <FundTable group={group} factors={factors} />;
        })()
      )}

      <p className="text-center text-[11px] text-fg-subtle">
        评分池共 {fmtInt(universe)} 只通过门槛的基金 · 各类别的门槛与因子口径见下方「模型说明」
      </p>
    </div>
  );
}
