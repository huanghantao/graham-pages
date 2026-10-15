import { notFound } from "next/navigation";

import { RunNotice } from "@/components/run-notice";
import { BackLink } from "@/components/ui/back-link";
import { ConclusionBar } from "@/components/stock/conclusion";
import { StockTabs } from "@/components/stock/tabs";
import { getStock, listStockCodes } from "@/lib/snapshot";

/**
 * 静态导出必须枚举全部详情页 —— 没有服务端可以按需渲染。
 *
 * ★ 枚举的是**快照里真实存在的**标的（每个市场的前若干名），不是全市场
 * 8,000+ 只。原因由实测得出：单只个股详情预渲染后约 67 KB（RSC flight
 * payload 会内联进 HTML，是原始 JSON 的 3.4 倍），全量即 ≥ 545 MB，
 * 超过 GitHub Pages 的 1 GB 站点上限。
 *
 * 未收录的标的不生成页面，用户从策略命中点进来会拿到 404 ——
 * 因此列表侧必须把没有详情页的行渲染成纯文本（见 `hit-list.tsx`），
 * 不能给出一个点了会碎的链接。
 */
export function generateStaticParams() {
  return listStockCodes().map((code) => ({ code }));
}


/**
 * 个股深度页。
 *
 * 版面结构（旧版是 3,000px 的长滚动，这里彻底重构）：
 *
 * 1. **粘性结论栏** —— 滚到任何位置都能看到安全边际，这是最关键的一处改进；
 * 2. **标签页** —— 按用户的问题切分（概览 / 判据 / 财务 / 溯源），
 *    而不是把所有数据堆在一起；
 * 3. **首屏即结论** —— 用户不必滚动就能判断"值不值得继续看"。
 */
export default async function StockPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const detail = await getStock(decodeURIComponent(code));
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      {/* 个股可以从筛选器、策略命中、基金持仓等多个入口进来，
          返回目标不唯一 —— 因此回到「个股」（全市场总入口）。 */}
      <BackLink href="/screener" label="个股" />

      <ConclusionBar
        name={detail.security.name}
        code={detail.security.code}
        market={detail.security.market_label}
        industry={detail.security.industry}
        asOf={detail.as_of}
        score={detail.score}
        margin={detail.margin}
        riskCount={detail.risk_flags.length}
      />

      <RunNotice status={detail.status} />

      <StockTabs detail={detail} />
    </div>
  );
}
