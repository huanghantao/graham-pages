"use client";

/**
 * 顶部导航。
 *
 * 设计：粘性 + 背景模糊。滚动时内容从导航下方穿过，比实心背景更有层次感，
 * 且不遮挡内容（用户随时知道自己在哪、能去哪）。
 *
 * 导航用**路径高亮**而非选中态组件：这是多页应用，当前路由由 URL 决定，
 * 不需要额外的状态同步。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

/**
 * 导航项。
 *
 * ## 命名纪律：以「你会看到什么」命名，不以「用什么机制」命名
 *
 * 早期版本是：温度计 / 策略 / **筛选器** / 基金 / **数据健康** / 方法论。
 * 问题不是某一项不好，而是**六项分属六个抽象层级**：
 *
 * | 项 | 层级 |
 * |---|---|
 * | 温度计 | 比喻 |
 * | 策略 | 内容（现成的策略名单）|
 * | 筛选器 | **工具机制** |
 * | 基金 | 品类（一种资产类别）|
 * | 数据健康 | 属性（数据的运维状态）|
 * | 方法论 | 文档 |
 *
 * 层级不统一时，用户无法形成「这个菜单里放的是什么」的心智模型。
 * 其中最突兀的是「筛选器」—— 它是唯一以**工具机制**命名的项，
 * 而且没有说它筛的是什么（个股？基金？全站？），必须点进去才知道。
 *
 * 现在统一为「你会看到什么」：
 *
 * * 「筛选器」→「**个股**」：与「基金」构成一对**并列的资产类别**
 *   （你实际能买的就这两样），并明确了筛选对象是个股。
 *   页面内的「筛选条件」抽屉名称保持不变 —— 那是页面内的操作，
 *   与导航项不是一回事。
 * * 「数据健康」→「**数据可信度**」：与页面标题统一（原先不一致），
 *   且更准确 —— 它回答的是「这批数据能不能信」，而不只是「有没有报错」。
 *   随后**移出主导航**（见 app-footer.tsx 的说明）：它是运维视角，
 *   不属于「温度计 → 策略 → 个股 → 基金 → 方法论」这条投资决策主线。
 * * 「策略池」→「**策略**」：与导航统一（原先不一致）。
 *
 * ## 为什么只剩三项
 *
 * 「策略」与「方法论」两页已从公开站点移除：
 *
 * * 策略页给出的是**现成的名单**，读起来就是荐股；
 * * 方法论页给出的是**判据口径与出处**，读起来就是"该怎么投"。
 *
 * 本项目明确不提供投资建议，而在一个公开站点上，这两页是最容易被那样
 * 理解的内容。移除的是**公开发布**，不是实现 —— 策略与方法论在私有
 * 仓库里与 API 上都完整保留。
 *
 * 于是导航回到一句话能说清的范围：**温度计（现在贵不贵）→ 个股 → 基金**。
 *
 * 导航标签与页面标题**必须一致**，这条由
 * `tests/unit/test_frontend_contracts.py::TestNavMatchesPageTitle` 守住 ——
 * 不一致会让用户点进页面后怀疑「我是不是点错了」。
 */
const NAV = [
  { href: "/", label: "温度计", match: (p: string) => p === "/" },
  { href: "/screener", label: "个股", match: (p: string) => p.startsWith("/screener") || p.startsWith("/stocks") },
  { href: "/funds", label: "基金", match: (p: string) => p.startsWith("/funds") },
] as const;

export function AppHeader() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line/70 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[80rem] items-center gap-2 px-4 py-2.5 sm:gap-4 sm:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-[14px] font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-md bg-fg text-[11px] font-bold text-fg-inverse"
            >
              G
            </span>
            <span className="hidden sm:inline">格雷厄姆工作台</span>
          </Link>

          {/* sm 及以上：导航与品牌同排（空间充足，无需换行） */}
          <nav aria-label="主导航" className="hidden min-w-0 items-center gap-0.5 sm:flex">
            {NAV.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <SearchTrigger />
            <ThemeToggle />
          </div>
        </div>

        {/*
          导航独占一行。

          ## 为什么不在同一行里横向滚动

          原先导航与品牌、搜索、主题切换挤在一行，配 `overflow-x-auto`。
          实测手机 393px 下导航只有 **203px** 可用，而 5 项需要 **267px** ——
          「方法论」被挤出屏幕。虽然技术上可横向滚动，但截图确认
          **用户看不到它**，而且没有任何滚动提示（滚动条被刻意隐藏）。

          加 mask 渐隐提示只能"暗示右边有东西"，仍要用户主动横滑。
          一级导航需要横滑才能发现，是拿可用性换整洁。

          改为导航独占一行：手机端多占约 36px 高度，换取
          **五个入口全部可见、零交互成本**。这是划算的 ——
          导航的存在意义就是随时可达。

          ## 为什么不用"汉堡菜单"

          汉堡菜单把 5 个入口藏进一次点击。本站的导航只有 5 项、
          且构成一条决策主线（温度计 → 策略 → 个股 → 基金 → 方法论），
          值得常驻可见 —— 用户应当能一眼看到"这条路径有哪些站"。
        */}
        <nav
          aria-label="主导航"
          className="mx-auto flex w-full max-w-[80rem] items-center gap-0.5 overflow-x-auto px-3 pb-1.5 sm:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
      </header>
      {/* 命令面板挂在 header 外，避免被 header 的 backdrop 层叠上下文裁剪 */}
      <CommandPalette />
    </>
  );
}

/** 单个导航项。移动端与桌面端共用，保证两处样式与选中逻辑一致。 */
function NavLink({
  item,
  pathname,
}: {
  item: (typeof NAV)[number];
  pathname: string;
}) {
  const active = item.match(pathname);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-surface text-fg"
          : "text-fg-subtle hover:bg-surface/60 hover:text-fg-muted",
      )}
    >
      {item.label}
    </Link>
  );
}

/** 搜索入口。点击等价于按下 ⌘K —— 两者进入同一个面板。 */
function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => {
        // 复用面板的全局快捷键逻辑：派发一个合成的 ⌘K 事件。
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
        );
      }}
      className="group flex items-center gap-2 rounded-lg border border-line/70 bg-surface px-2.5 py-1.5 text-[12.5px] text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted"
    >
      <span aria-hidden>⌕</span>
      <span className="hidden md:inline">搜索标的</span>
      <kbd className="num hidden rounded border border-line/70 bg-bg-elevated px-1 py-px text-[10px] md:inline">
        ⌘K
      </kbd>
    </button>
  );
}
