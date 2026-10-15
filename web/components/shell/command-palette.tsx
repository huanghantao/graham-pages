"use client";

/**
 * 命令面板（⌘K / Ctrl+K）。
 *
 * 目的：让"搜索任意标的并跳转"变成一次按键 + 几个字符。
 * 对每天使用的工作台而言，这是价值最高的单一交互 —— 比任何菜单都快。
 *
 * 搜索范围是**股票与基金**（此前只有股票：输入基金代码永远返回空，
 * 而界面上看不出任何异常）。静态站点上没有后端可查，因此索引随站点一起
 * 发布，面板在**首次打开时**取一次并缓存在内存里。
 *
 * 实现要点：
 * - **索引按需加载**：⌘K 是低频入口，没必要让每个页面都背上这份数据；
 * - **输入防抖 180ms**：匹配在本地做，防抖是为了避免每敲一个字都重排长列表；
 * - **键盘导航**：↑↓ 选择、Enter 跳转、Esc 关闭；
 * - **无结果时给出原因**：要说清"本站只收录排名靠前的部分标的"这个边界。
 *   这与后端 `UnmatchedCode` 是同一个主张 —— 把边界说出来，别让用户猜。
 * - **请求失败时清空并说明**：失败若只写进 console，界面会继续显示上一次的
 *   结果，用户以为搜的是新词 —— 那是最糟的一种"看起来正常"。
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Portal } from "@/components/ui/portal";
import { withBasePath } from "@/lib/base-path";
import type {
  AssetKind,
  FundSearchDetail,
  SearchHit,
  SearchIndex,
  SearchIndexEntry,
  StockSearchDetail,
} from "@/lib/types";

import { SearchHitRow } from "./search-hit-row";

/**
 * 类别 → 落地页前缀。
 *
 * 路由是前端的领域（Next 的路由表），因此**不**由服务端下发行程地址。
 * 用 `Record<AssetKind, string>` 保证新增一类资产时这里编译失败，
 * 而不是让它默默跳到 404。
 */
const KIND_ROUTE: Record<AssetKind, string> = {
  stock: "/stocks",
  fund: "/funds",
};

/** 单次返回的最大命中数。 */
const HIT_LIMIT = 12;

/**
 * 在索引里做一次本地匹配。
 *
 * 排序口径与后端 `query/search.py` 的 `rank_hits` 保持一致：**前缀命中
 * 排在中间命中之前**，同类内按代码定序。这不足以复刻后端的全部细节，
 * 但对一个只有几百条的索引来说，"前缀优先"就是用户在意的全部 ——
 * 输入 `600` 时想看到的是 `600519`，而不是 `0600xxx`。
 */
function matchIndex(index: SearchIndex, rawQuery: string): SearchHit[] {
  const needle = rawQuery.trim().toLowerCase();
  if (!needle) return [];

  const scored: { hit: SearchHit; tier: 0 | 1 }[] = [];
  for (const entry of index.entries) {
    const code = entry.code.toLowerCase();
    const name = entry.name.toLowerCase();
    const isPrefix = code.startsWith(needle) || name.startsWith(needle);
    const isInfix = !isPrefix && (code.includes(needle) || name.includes(needle));
    if (!isPrefix && !isInfix) continue;
    scored.push({ hit: toHit(entry, isPrefix ? "prefix" : "infix"), tier: isPrefix ? 0 : 1 });
  }

  scored.sort((a, b) => a.tier - b.tier || a.hit.code.localeCompare(b.hit.code));
  return scored.slice(0, HIT_LIMIT).map((item) => item.hit);
}

/** 把索引条目转成面板渲染用的命中（补上按查询词算出的匹配层级）。 */
function toHit(entry: SearchIndexEntry, tier: "prefix" | "infix"): SearchHit {
  if (entry.kind === "fund") {
    return {
      kind: "fund",
      code: entry.code,
      name: entry.name,
      match_tier: tier,
      detail: entry.detail as FundSearchDetail,
    };
  }
  return {
    kind: "stock",
    code: entry.code,
    name: entry.name,
    match_tier: tier,
    detail: entry.detail as StockSearchDetail,
  };
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // 全局快捷键
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
        return;
      }
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // 打开时聚焦输入框并锁滚动
  //
  // ★ 这里有个**两层时序**问题，只修一半没用：
  //
  //   1. ``open`` 变 true 时，``Portal`` 内部的 ``mounted`` 还是 false，
  //      它返回 ``null`` —— **输入框尚未渲染**，``inputRef.current`` 是 null。
  //      所以立刻 `focus()` 什么也不会发生。
  //   2. ``Portal`` 自己的 effect 随后才把 ``mounted`` 置 true 并触发重渲染。
  //
  //   因此聚焦必须**重试到输入框真的出现为止**，而不是固定等一帧。
  //   最初实现是直接 `inputRef.current?.focus()`，实测焦点停在触发按钮上 ——
  //   用户按 ⌘K 后打字没有任何反应，必须手动点一下输入框
  //   （快捷键与点按钮两种入口都一样）。这是命令面板最基本的交互承诺。
  //
  //   改用「逐帧重试、上限若干次」：正常情况下第 1~2 帧就成功；
  //   若上游真出了问题，最多试 20 帧后放弃，不会无限空转。
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let cancelled = false;
    let frames = 0;
    let handle = 0;

    const tryFocus = () => {
      if (cancelled) return;
      const input = inputRef.current;
      if (input && document.activeElement !== input) {
        input.focus({ preventScroll: true });
      }
      if (input && document.activeElement === input) return; // 成功
      if (frames++ < 20) handle = requestAnimationFrame(tryFocus);
    };
    handle = requestAnimationFrame(tryFocus);

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
      document.body.style.overflow = previous;
    };
  }, [open]);

  // 索引按需加载：⌘K 是低频入口，没必要让每个页面都背上这份数据。
  // 加载一次即缓存；失败则记录以便在空态里说明**原因**。
  useEffect(() => {
    if (!open || index !== null) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // ★ 必须显式拼 basePath：Next 只对框架生成的 URL 自动加前缀，
        //   手写 fetch 在 GitHub Pages 的项目页上会 404 ——
        //   而症状是"只有搜索不工作"，首页一切正常，很容易漏掉。
        const response = await fetch(withBasePath("/data/search-index.json"));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as SearchIndex;
        if (!cancelled) {
          setIndex(data);
          setFailed(false);
        }
      } catch (error) {
        console.error("[palette] 搜索索引加载失败", error);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, index]);

  // 防抖匹配。静态站点上是**本地**匹配，不需要网络；防抖是为了避免
  // 每敲一个字都重排一遍列表（索引虽小，重排仍会打断输入法联想）。
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setFailed(index === null ? failed : false);
      return;
    }
    setLoading(index === null);
    const timer = setTimeout(() => {
      if (index === null) return;
      setHits(matchIndex(index, trimmed));
      setActive(0);
      setLoading(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [query, open, index, failed]);

  const go = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      setQuery("");
      router.push(`${KIND_ROUTE[hit.kind]}/${hit.code}`);
    },
    [router],
  );

  const onListKey = (event: React.KeyboardEvent) => {
    if (hits.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((previous) => (previous + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((previous) => (previous - 1 + hits.length) % hits.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = hits[active];
      if (hit) go(hit);
    }
  };

  if (!open) return null;

  const trimmed = query.trim();

  return (
    <Portal>
      <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="搜索标的">
      <button
        type="button"
        aria-label="关闭搜索"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
      />
      <div className="animate-rise absolute left-1/2 top-[12vh] w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line-strong bg-bg-elevated shadow-modal">
        <div className="flex items-center gap-3 border-b border-line/70 px-4">
          <span aria-hidden className="text-fg-subtle">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onListKey}
            placeholder="搜索股票或基金：代码 / 名称…"
            className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] outline-none placeholder:text-fg-subtle"
          />
          <kbd className="num hidden rounded border border-line/70 bg-surface px-1.5 py-0.5 text-[10px] text-fg-subtle sm:block">
            Esc
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-[min(24rem,50vh)] overflow-y-auto p-1.5">
          {hits.map((hit, index) => (
            <li key={`${hit.kind}:${hit.code}`}>
              <SearchHitRow
                hit={hit}
                active={index === active}
                onHover={() => setActive(index)}
                onSelect={() => go(hit)}
              />
            </li>
          ))}

          {trimmed && hits.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-fg-subtle">
              {loading ? (
                "搜索中…"
              ) : failed ? (
                // 静态站点上不存在"后端没启动"这回事 —— 索引是随站点发布的
                // 一个文件。说成"请确认后端已启动"会把排查方向指错。
                "搜索索引加载失败 —— 请刷新页面重试"
              ) : (
                <ScopeNotice
                  query={trimmed}
                  note={index?.published_note ?? "本站只收录部分标的。"}
                />
              )}
            </li>
          ) : null}

          {!trimmed ? (
            <li className="px-3 py-8 text-center text-[13px] text-fg-subtle">
              输入代码或名称开始搜索（股票与基金）
            </li>
          ) : null}
        </ul>

        <div className="flex items-center justify-between border-t border-line/70 px-4 py-2 text-[10px] text-fg-subtle">
          <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
          <span>数据来自本地快照，不消耗配额</span>
        </div>
        </div>
      </div>
    </Portal>
  );
}

/**
 * "没有匹配" —— 必须带上**站点收录范围**，不能只说"没有"。
 *
 * 静态站点只发布每个市场排名靠前的个股与每类排名靠前的基金，因此
 * "搜不到"最常见的原因是**不在收录范围内**，而不是拼写错误。
 * 把边界说出来，用户才知道该去哪里找它 —— 这是本项目"静默失败要变成
 * 响亮失败"在搜索入口上的落点。
 *
 * （后端版本还能区分"这个代码存在、但不在评分池里"（`UnmatchedCode`）——
 * 那需要完整标的清单，静态站点不可能背上。故这里统一给出范围说明。）
 */
function ScopeNotice({ query, note }: { query: string; note: string }) {
  return (
    <div className="space-y-1.5 text-left">
      <div>没有匹配「{query}」的标的</div>
      <div className="text-[12px] leading-5 text-fg-muted">{note}</div>
      <div className="text-[12px] leading-5 text-fg-subtle">
        若你确定代码正确，它很可能不在本站收录范围内。
      </div>
    </div>
  );
}
