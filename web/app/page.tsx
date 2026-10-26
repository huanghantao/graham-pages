import Link from "next/link";

import { AllocationBar, PercentileBar, TemperatureGauge } from "@/components/charts";
import { RunNotice } from "@/components/run-notice";
import { Bullets, Card, CardBody, CardHeader, Stat } from "@/components/ui/primitives";
import { getThermometer } from "@/lib/snapshot";
import { hasCapability, showsCriterionSources } from "@/lib/ui-profile";
import { fmt, fmtInt, fmtPercent, fmtRatio, fmtSigned } from "@/lib/format";

export const metadata = { title: "市场温度计" };

/**
 * 首页：市场温度计。
 *
 * 版面结构（第一屏决定产品印象，因此刻意分层）：
 *
 * 1. **Hero**：弧线仪表 + 三个核心数字 + 配置条 —— 一眼回答"今天该不该出手"；
 * 2. **Bento 网格**：指数估值 / 市场宽度 / 判据要点 / 方法论，按重要性排布；
 * 3. **入口**：跳转到策略与筛选器。
 *
 * 依据全部来自格雷厄姆原文（E/P 与债券收益率比较、25%–75% 股债规则），
 * 不是本站自创的合成指标 —— 方法论与局限随结论一同呈现。
 */
export default async function HomePage() {
  const reading = await getThermometer();

  if (!reading) {
    return (
      <div className="space-y-5">
        <PageTitle />
        <Card>
          <CardBody>
            <p className="text-[15px] font-medium">无法连接数据服务</p>
            <div className="mt-2 space-y-1.5 text-[13px] text-fg-muted">
              <p>
                启动后端：
                <code className="num ml-2 rounded border border-line/70 bg-surface px-1.5 py-0.5 text-[11.5px]">
                  python -m graham.cli serve
                </code>
              </p>
              <p>
                生成快照：
                <code className="num ml-2 rounded border border-line/70 bg-surface px-1.5 py-0.5 text-[11.5px]">
                  python -m graham.cli etl
                </code>
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const premium = reading.equity_risk_premium ?? null;
  const weight = reading.suggested_equity_weight ?? null;
  const band = reading.methodology?.equity_band ?? [0.25, 0.75];
  const neutral = reading.methodology?.neutral ?? 0.5;
  const breadth = reading.breadth ?? null;
  const indices = reading.indices ?? [];

  return (
    <div className="animate-rise space-y-5">
      <PageTitle />

      {/*
        首页的 status 来自同一个接口。不再单独传 `stale` ——
        陈旧度已由服务端的 freshness 统一判定，避免两处各算一套。
      */}
      <RunNotice status={reading.status} />

      {!reading.available ? (
        <Card>
          <CardBody>
            <p className="text-[14px]">{reading.message}</p>
          </CardBody>
        </Card>
      ) : (
        <>
          {/* ── Hero ─────────────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <Card className="flex items-center justify-center">
              <CardBody className="flex w-full flex-col items-center">
                <TemperatureGauge value={reading.temperature ?? null} size={280} />
                <p className="mt-1 text-center text-[11.5px] leading-5 text-fg-subtle">
                  由估值分位（60%）与股权风险溢价（40%）合成，仅用于展示
                  <br />
                  仓位建议只由原文的 E/P 判据与 25%–75% 规则决定
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                  <Stat
                    label="股权风险溢价"
                    value={fmtSigned(premium)}
                    unit="pp"
                    tone={premium !== null && premium > 0 ? "pass" : "fail"}
                    size="lg"
                    hint={
                      premium !== null
                        ? premium > 0
                          ? "股票相对债券有吸引力"
                          : "债券相对股票有吸引力"
                        : undefined
                    }
                  />
                  <Stat
                    label="建议股票仓位"
                    value={weight === null ? "—" : fmtRatio(weight)}
                    tone="accent"
                    size="lg"
                    hint={`债券 ${fmtRatio(reading.suggested_bond_weight ?? null)}`}
                  />
                </div>

                <div className="border-t border-line/70 pt-5">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="micro">股债配置区间</span>
                    <span className="text-[11px] text-fg-subtle">
                      原文规定 {fmtRatio(band[0])}–{fmtRatio(band[1])}
                    </span>
                  </div>
                  <AllocationBar equityWeight={weight} band={band} neutral={neutral} />
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-line/70 pt-5">
                  <Stat label="盈利收益率" value={fmtPercent(reading.earnings_yield ?? null)} size="sm" />
                  <Stat label="10Y 国债" value={fmtPercent(reading.bond_yield ?? null, 4)} size="sm" />
                  <Stat
                    label="沪深300 PE"
                    value={fmt(indices.find((i) => i.code === "000300.SH")?.pe ?? null)}
                    size="sm"
                  />
                </div>

                {reading.rebalance_action ? (
                  <div className="rounded-xl border border-line/70 bg-surface px-3.5 py-3 text-[12.5px] leading-5 text-fg-muted">
                    <span className="font-medium text-fg">再平衡　</span>
                    {reading.rebalance_action}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </div>

          {/* ── Bento 网格 ───────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-12">
            {/* 指数估值 */}
            <Card className="lg:col-span-7">
              <CardHeader title="主要指数估值" hint="含自身历史分位" />
              <CardBody className="space-y-5 pt-4">
                {indices.map((index) => (
                  <div key={index.code}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-[14px] font-medium">{index.name}</span>
                      <span className="num text-[12px] text-fg-subtle">
                        PE {fmt(index.pe)} · PB {fmt(index.pb, 3)} · 股息{" "}
                        {fmtPercent(index.dividend_yield)}
                      </span>
                    </div>
                    {index.pe_percentile ? (
                      <PercentileBar
                        percentile={index.pe_percentile.percentile}
                        sampleSize={index.pe_percentile.sample_size}
                        current={index.pe_percentile.value}
                        median={index.pe_percentile.median}
                        min={index.pe_percentile.min}
                        max={index.pe_percentile.max}
                      />
                    ) : (
                      <p className="text-[11.5px] text-fg-subtle">
                        无历史序列，故不输出分位
                      </p>
                    )}
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* 市场宽度 —— 承载"低 PE 陷阱"这个核心发现 */}
            <Card className="lg:col-span-5">
              <CardHeader
                title="全市场宽度"
                hint={breadth ? `${fmtInt(breadth.total)} 只` : undefined}
              />
              <CardBody className="pt-4">
                {breadth ? (
                  <>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                      <Stat
                        label="PE 不适用"
                        value={fmtInt(breadth.pe_unusable)}
                        tone="fail"
                        size="md"
                        hint={`${fmtPercent(breadth.pe_unusable_ratio ?? null, 1)} · 缺失或 ≤ 0`}
                      />
                      <Stat
                        label="最近年度亏损"
                        value={fmtInt(breadth.loss_making)}
                        tone="fail"
                        size="md"
                        hint={`${fmtPercent(breadth.loss_making_ratio ?? null, 1)} · 独立印证`}
                      />
                      <Stat
                        label="破净"
                        value={fmtInt(breadth.below_book)}
                        size="md"
                        hint={`${fmtPercent(breadth.below_book_ratio ?? null, 1)} · 0 < PB < 1`}
                      />
                      <Stat
                        label="低 PE"
                        value={fmtInt(breadth.low_pe)}
                        size="md"
                        hint="0 < PE < 10"
                      />
                    </div>

                    <div className="mt-5 rounded-xl border border-fail/25 bg-fail-bg px-3.5 py-3">
                      <p className="text-[12.5px] font-medium text-fail">
                        为什么这组数字重要
                      </p>
                      <p className="mt-1.5 text-[12px] leading-5 text-fg-muted">
                        这些标的的 PE 不具可比性。任何按 PE 升序的选股都会把它们排在
                        最前面 —— 而它们的 PE 之所以“小”，是因为公司不赚钱。
                        本站的符号守卫会直接剔除它们。
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-fg-subtle">
                        实测提醒：上游接口对“PE 不适用”有两种表示 —— 带筛选条件的查询返回
                        <strong className="text-fg-muted">负数</strong>，全市场投影返回{" "}
                        <strong className="text-fg-muted">null</strong>。
                        只统计负数会低估近两个数量级（本站曾把 1,646 只误报为 7 只），
                        故此处统计“无正值”的全体，并由年度亏损独立印证。
                      </p>
                    </div>
                  </>
                ) : null}
              </CardBody>
            </Card>

            {/* 判据要点 */}
            <Card className="lg:col-span-7">
              <CardHeader title="判据要点" hint="每条都可复核" />
              <CardBody className="pt-4">
                <Bullets items={reading.signals ?? []} className="text-[12.5px] leading-6" />
              </CardBody>
            </Card>

            {/*
            这张卡分两段：**出处**与**已知局限**。

            已知局限两者都显示 —— 它披露的是"这个模型做不到什么"，
            属于负责任的部分，删掉会让页面显得比实际更确定。

            出处只在档案允许时显示（工作台要它来复核判据来源）。
            `sources` 本身也由发布档案决定是否写进快照，因此这里是
            "有就渲染"，而不是"判断该不该有"。
          */}
          <Card className="lg:col-span-5">
            <CardHeader
              title={showsCriterionSources() ? "方法论与已知局限" : "已知局限"}
              hint="不隐藏计算的边界"
            />
            <CardBody className="space-y-4 pt-4">
              {showsCriterionSources() && (reading.methodology?.sources?.length ?? 0) > 0 ? (
                <div>
                  <p className="micro mb-1.5">出处</p>
                  <Bullets items={reading.methodology?.sources ?? []} />
                </div>
              ) : null}
              <div className="rounded-xl border border-warn/25 bg-warn-bg p-3">
                <p className="micro mb-1.5 !text-warn">已知局限</p>
                <p className="text-[12px] leading-5 text-fg-muted">
                  {reading.methodology?.caveat}
                </p>
              </div>
            </CardBody>
          </Card>
          </div>

          {/* ── 入口 ─────────────────────────────────────────────── */}
          {/*
            入口卡与主导航**同源**：都按当前档案的能力集渲染。
            策略卡只在策略产物已发布时出现 —— 与页面本身、以及导航项
            用的是同一个开关（`hasCapability`），因此不会出现
            "有入口没页面"或"有页面没入口"。
          */}
          <div className="grid gap-4 sm:grid-cols-2">
            {hasCapability("strategies") ? (
              <EntryCard
                href="/strategies"
                title="策略池"
                description="防御型七条、Net-Net 双口径、破净+盈利 —— 每个策略都附带方法论提醒"
              />
            ) : null}
            <EntryCard
              href="/screener"
              title="个股"
              // 原文写的是"筛选全市场"，而静态站点只发布每个市场的前若干名 ——
              // 那句话在收录范围之外许下了本站给不出的承诺。
              description="按安全边际、便宜度、质量度即时筛选本站收录的个股，支持象限与行业过滤"
            />
            <EntryCard
              href="/funds"
              title="基金"
              description="多因子评分 × 按类别分组，同类内比较。含低成本宽基 ETF 方案"
            />
          </div>
        </>
      )}
    </div>
  );
}

function PageTitle() {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h1 className="text-[22px] font-semibold tracking-tight">市场温度计</h1>
      <p className="text-[13px] text-fg-subtle">
        回答一个问题：<span className="text-fg-muted">今天该不该出手？</span>
      </p>
    </div>
  );
}

function EntryCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-line/70 bg-bg-elevated p-5 shadow-card transition-all duration-200 hover:border-line-strong hover:shadow-float"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight">{title}</div>
          <p className="mt-1.5 text-[12.5px] leading-5 text-fg-subtle">{description}</p>
        </div>
        <span className="shrink-0 text-fg-subtle transition-transform duration-200 group-hover:translate-x-1">
          →
        </span>
      </div>
    </Link>
  );
}
