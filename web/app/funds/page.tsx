import type { Metadata } from "next";

import { FactorLegend } from "@/components/funds/fund-table";
import { FundTabs } from "@/components/funds/fund-tabs";
import { RunNotice } from "@/components/run-notice";
import { Card, CardBody, Disclosure } from "@/components/ui";
import { getEtfs, getFunds } from "@/lib/snapshot";
import { fmtInt } from "@/lib/format";


export const metadata: Metadata = {
  title: "基金",
  description:
    "多因子基金评分：收益、回撤、持仓质量与结构，在同类内做百分位归一后加权。每类基金分别成榜，不跨类比较。",
};

/**
 * 基金页。
 *
 * ## 布局原则：数据在前，解释在后
 *
 * 早期版本把「这个模型是什么」「入池门槛」「评分模型」三张说明卡
 * 放在榜单**之前**，手机端要滚 1,707px（2 屏）才看到第一张榜。
 * 而各类基金又垂直堆叠，整页 48.6 屏 ——
 * 想看「中长期纯债」要先滚过 22,000px。
 *
 * 现在：
 *
 * 1. 标题 + 一句话定位；
 * 2. 快照状态；
 * 3. **类别切换 + 当前类别的榜**（内容前置）；
 * 4. 模型说明、入池门槛、因子表 —— 全部收进折叠区。
 *
 * 解释性内容**一条都没删**（本站原则是不隐藏口径与局限），
 * 只是不再挡在数据前面。
 *
 * ## 类别选择为什么不再走服务端
 *
 * 原先是 `?c=` 由服务端读取，好处是首屏就是正确标签、不会闪。
 * 静态导出下**没有服务端**可读参数，因此改由 `FundTabs` 在挂载后读一次
 * URL（见该组件）。代价是切换发生在一帧之后，收益是深度链接仍然可用 ——
 * 而若完全不读，组件里那段 URL 同步逻辑会把 `?c=` 直接**删掉**，
 * 用户的分享链接会被静默丢弃，那比闪一下糟得多。
 */
export default async function FundsPage() {
  const [funds, etfResponse] = await Promise.all([getFunds(), getEtfs()]);
  const groups = funds?.groups ?? [];
  const factors = funds?.factors ?? [];
  const gates = funds?.gates ?? [];
  const etfs = etfResponse?.rows ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">基金</h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-6 text-fg-muted">
          用长期收益、回撤、持仓质量与结构给基金打分。每个因子在
          <strong className="text-fg">同类内</strong>换算为百分位再加权 ——
          因为「年化 5%」对纯债基金是优秀、对偏股基金是平庸，
          跨类别的绝对比较没有意义。因此每类基金<strong className="text-fg">分别成榜</strong>。
        </p>
      </div>

      <RunNotice status={funds?.status} />

      {groups.length === 0 ? (
        <Card>
          <CardBody className="py-8 text-center text-[13px] text-fg-subtle">
            {/*
              ★ 必须区分「没有数据」与「数据正在抓取」。
              早期版本无条件说「请先运行一次 ETL」—— 而 ETL **正在运行**时
              这句话是明确的假陈述，会让人以为系统坏了。
              （ETL 抓取约 110 秒，期间基金数据尚不可读。）
            */}
            {funds?.status?.is_updating
              ? "基金数据正在抓取中，约需 1~2 分钟。完成后刷新本页即可看到。"
              : "尚无基金评分。请先运行一次 ETL 生成快照。"}
          </CardBody>
        </Card>
      ) : (
        <FundTabs
          groups={groups}
          factors={factors}
          etfs={etfs}
          universe={funds?.universe ?? 0}
          initialKey=""
        />
      )}

      {/* ── 以下为解释性内容，默认收起 ─────────────────────────── */}

      <Disclosure summary="这个模型是什么、不是什么">
        <div className="space-y-2 text-[12px] leading-5.5 text-fg-muted">
          <p>
            <strong className="text-fg">它是</strong>：把历史业绩与当前持仓放在同一把尺子上排序。
            收益与回撤衡量「过去表现如何、过程有多难受」，持仓质量与便宜度衡量
            「现在手里拿的是什么」—— 后者能识别出「历史业绩好但当前重仓股质地转差」的基金。
          </p>
          <p>
            <strong className="text-fg">它不是</strong>：业绩预测。所有收益与回撤都是
            <strong className="text-warn">历史数据</strong>，不构成对未来的任何预示。
            过去五年年化 20% 的基金，未来五年完全可能亏损 —— 排行榜只描述已发生的事。
          </p>
          <p>
            <strong className="text-fg">分数只在本类别内可比</strong>。
            纯债榜首的 97 分不等于它比偏股榜首的 92 分更值得买，
            两者都只是「各自类别里最强的那一批」。选择哪一类取决于你的风险承受能力，
            那是本模型回答不了的问题。这也是为什么各类榜<strong className="text-fg-muted">用切换而非堆叠</strong> ——
            堆叠会让滚动时自然产生跨类别比较。
          </p>
        </div>
      </Disclosure>

      <Disclosure
        summary="入池门槛"
        hint={`评分池 ${fmtInt(funds?.universe ?? 0)} 只`}
      >
        <div className="space-y-2.5">
          {gates.map((gate) => (
            <div key={gate.key}>
              <p className="text-[12.5px] font-medium">{gate.label}</p>
              <p className="mt-0.5 text-[11px] leading-4.5 text-fg-subtle">{gate.reason}</p>
            </div>
          ))}
          <div className="border-t border-line/70 pt-2.5">
            <p className="text-[12.5px] font-medium">同一只基金只占一个榜位</p>
            <p className="mt-0.5 text-[11px] leading-4.5 text-fg-subtle">
              一只基金常有 A/C/E 等多个份额，持仓完全相同、只是费率结构不同。
              榜单按「基金名 + 类别」去重，保留
              <strong className="text-fg-muted">规模最大</strong>的份额作代表
              —— 规模大意味着流动性好、清盘风险低，这是唯一不需要额外判断的维度。
              被合并的份额如实标出，不做隐藏。
            </p>
          </div>
          <p className="border-t border-line/70 pt-2.5 text-[11px] leading-4.5 text-fg-subtle">
            同时排除：货币市场基金、被动/增强指数型基金、QDII、FOF、商品型与市场中性基金。
            指数型基金的业绩主要由跟踪标的决定，基金经理的主动能力不是主要变量，
            用同一套因子排序会误导。
          </p>
        </div>
      </Disclosure>

      <Disclosure summary="评分模型" hint={`${factors.length} 个因子`}>
        <FactorLegend factors={factors} />
      </Disclosure>
    </div>
  );
}
