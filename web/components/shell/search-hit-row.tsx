"use client";

/**
 * 搜索结果的一行 —— 两类资产共用行结构，只有「结论格」不同。
 *
 * ## 为什么单独成组件
 *
 * 结论口径的差异（个股看安全边际、基金看**同类**排名）必须被**穷尽**处理：
 * 新增一类资产时，这里的 `Record<AssetKind, …>` 与判别分支会**编译报错**，
 * 而不是在界面上悄悄少一列、或者把基金的排名当成个股的分数显示。
 *
 * 把这份差异从命令面板里分出来，面板才能专注在自己的三件事上：
 * 开合、输入防抖、键盘导航。
 */

import { cn } from "@/lib/cn";
import { fmt } from "@/lib/format";
import type { AssetKind, SearchHit } from "@/lib/types";

/**
 * 类别徽标文案。
 *
 * 用 `Record<AssetKind, string>` 而不是三元表达式：新增一类资产时
 * 这里会编译失败，提醒把徽标补齐。类别名是纯展示词汇，
 * 因此留在前端（后端的中文标签用于**数据口径**，如基金类别名，
 * 那类映射一旦漂移会显示错结论，必须由服务端下发）。
 */
const KIND_LABEL: Record<AssetKind, string> = {
  stock: "个股",
  fund: "基金",
};

export function SearchHitRow({
  hit,
  active,
  onHover,
  onSelect,
}: {
  hit: SearchHit;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        active ? "bg-surface-hover" : "hover:bg-surface",
      )}
    >
      <span className="num w-20 shrink-0 text-[12px] text-fg-subtle">{hit.code}</span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{hit.name}</span>

      <span className="shrink-0 rounded border border-line/70 px-1.5 py-px text-[10px] text-fg-subtle">
        {KIND_LABEL[hit.kind]}
      </span>

      {/* 结论格：两类资产的口径不同，各自渲染自己的那一个 */}
      {hit.kind === "stock" ? (
        <StockConclusion mos={hit.detail.mos} industry={hit.detail.industry} />
      ) : (
        <FundConclusion
          rank={hit.detail.rank}
          peerCount={hit.detail.peer_count}
          categoryLabel={hit.detail.category_label}
        />
      )}
    </button>
  );
}

/** 个股的结论：安全边际。 */
function StockConclusion({
  mos,
  industry,
}: {
  mos: number | null;
  industry: string | null;
}) {
  return (
    <>
      {industry ? (
        <span className="hidden shrink-0 text-[11px] text-fg-subtle sm:block">
          {industry}
        </span>
      ) : null}
      <span
        className="num w-24 shrink-0 text-right text-[12px] font-medium"
        style={{
          color:
            mos === null
              ? "var(--fg-subtle)"
              : mos >= 50
                ? "var(--pass)"
                : "var(--fail)",
        }}
      >
        {/* 带标签而不是只给数字：混合结果里"62.4" 与 "#12/394" 并排时，
            没有标签就必须靠记忆区分两者 */}
        安全边际 {mos === null ? "—" : fmt(mos, 1)}
      </span>
    </>
  );
}

/**
 * 基金的结论：**同类**排名。
 *
 * 必须同时给出分母（`peer_count`）："#12" 是 394 只偏股里的第 12，
 * 还是 37 只纯债里的第 12 —— 两者的含义天差地别。
 */
function FundConclusion({
  rank,
  peerCount,
  categoryLabel,
}: {
  rank: number | null;
  peerCount: number;
  categoryLabel: string;
}) {
  return (
    <>
      <span className="hidden shrink-0 text-[11px] text-fg-subtle sm:block">
        {categoryLabel}
      </span>
      <span className="num w-24 shrink-0 text-right text-[12px] font-medium text-fg-muted">
        {rank === null ? "同类 —" : `同类 #${rank}/${peerCount}`}
      </span>
    </>
  );
}
