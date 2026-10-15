import { RunNotice } from "@/components/run-notice";
import { ScreenerClient } from "@/components/screener/screener-client";
import { getManifest, getScreen } from "@/lib/snapshot";

/**
 * 标题与导航标签保持一致（「个股」）—— 见 app-header.tsx 的命名纪律说明。
 * 页面内的「筛选条件」抽屉名称不变：那是页面内的操作，与导航项不是一回事。
 */
export const metadata = {
  title: "个股",
  description:
    "本站收录的个股按安全边际排序，可按市场、行业、成交额与动量即时筛选。分数含雷区扣分，并披露数据覆盖率。",
};

/**
 * 筛选器页（构建期读快照 → 客户端即时筛选）。
 *
 * 与 API 时代的区别：那时是"每页 200 行、需要时再向服务端要更多"，
 * 现在是"构建期已经把每个市场的前 N 名固化进站点"。因此**没有下一页** ——
 * 而这件事必须说清楚，否则用户会把收录的 100 条当成全市场。
 *
 * 页面上同时给出两个含义完全不同的数字：
 * - `returned`：本站收录了多少（用户**能看**多少）；
 * - `total`：快照里全市场有多少（用户**没看到**多少）。
 *
 * 只显示后者，正是本项目最反对的那种"看起来精确"的失真；
 * 只显示前者，则丢掉了"这份榜单是从多大范围里选出来的"这一关键背景。
 */
export default async function ScreenerPage() {
  const [page, manifest] = await Promise.all([getScreen(), getManifest()]);

  return (
    <div className="animate-rise space-y-4">
      <RunNotice status={page?.status} />

      <ScreenerClient
        rows={page?.rows ?? []}
        returned={page?.returned ?? 0}
        total={page?.total ?? 0}
        run={page?.run ?? null}
        markets={page?.markets ?? []}
        publishedNote={
          page?.published_note ??
          `本站为静态收录站点，只发布每个市场安全边际排名靠前的 ${
            manifest?.published?.stock_per_market ?? "若干"
          } 只。`
        }
      />
    </div>
  );
}
