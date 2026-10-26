import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/ui/back-link";
import { FactorRow } from "@/components/funds/factor-bar";
import { HolderBar } from "@/components/funds/holder-bar";
import { YearlyReturns } from "@/components/funds/yearly-returns";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { getFundDetail, getFunds, getPublishedCodes, listFundCodes } from "@/lib/snapshot";
import { cn } from "@/lib/cn";
import { fmt, fmtDate, fmtInt } from "@/lib/format";

/**
 * 枚举快照里真实存在的基金详情页。
 *
 * 只覆盖**已收录**的那些（每个类别的前若干名），不是全部 697 只 ——
 * 理由与个股页相同：静态导出要把每一页预渲染成 HTML，而站点有体积上限。
 */
export function generateStaticParams() {
  return listFundCodes().map((code) => ({ code }));
}


const PERIOD_LABELS: Record<string, string> = {
  "1": "近 1 年",
  "3": "近 3 年",
  "5": "近 5 年",
  "10": "近 10 年",
};

export default async function FundDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  // 因子声明来自榜单快照（前端不硬编码口径）。静态站点上不需要"只取 1 条"
  // 这种省流手段 —— 读的是同一个本地文件，取多取少成本一样。
  const [detail, listing] = await Promise.all([getFundDetail(code), getFunds()]);
  if (!detail) notFound();

  // 本站收录的标的集合。持仓个股与"被合并的份额"绝大多数都不在其中，
  // 因此这两处必须按它决定渲染成链接还是纯文本（见下方用法）。
  const published = getPublishedCodes();

  const byKey = new Map(detail.factors.map((f) => [f.key, f]));
  const na = new Map(detail.not_applicable.map((item) => [item.key, item.reason]));
  const specs = (listing?.factors ?? []).filter(
    (spec) =>
      spec.categories.length === 0 ||
      spec.categories.some((item) => item.key === detail.category),
  );
  const cumulative = detail.context.cumulative_returns ?? {};
  const drawdowns = detail.context.drawdowns ?? {};
  // 被剔除的回撤原始值（上游返回的结构性不可能的值）。
  // 必须单独取出：这类格子不能显示成"—"（那与"上游没给数据"无法区分），
  // 也不能显示成原值（那会让相邻两期的数字自相矛盾）。
  const rejectedDrawdowns = detail.context.rejected_drawdowns ?? {};
  const smoothness = detail.context.smoothness;

  return (
    <div className="space-y-5">
      <BackLink href="/funds" label="基金榜" />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{detail.name}</h1>
          <p className="num mt-1 text-[12px] text-fg-subtle">
            {detail.code} · {detail.category_label}
          </p>
        </div>
        <div className="flex items-baseline gap-3">
          {/*
            按「是否持股」分色，而不是钉死某一个类别。
            原先写的是 `category === "equity_hybrid"`，七类之后
            灵活配置与二级债基同样持股却都是中性色 —— 视觉上把
            四个持股类别说成了三个不同类别。
          */}
          <Badge
            tone={
              (listing?.groups ?? []).find((g) => g.category === detail.category)?.holds_equity
                ? "accent"
                : "neutral"
            }
          >
            {detail.category_label}
          </Badge>
          <span className="text-[11.5px] text-fg-subtle">
            同类第 {detail.rank ?? "—"} / {fmtInt(detail.peer_count)} 名
            {detail.universe_size && detail.universe_size > detail.peer_count ? (
              <span
                className="ml-1.5 text-fg-subtle"
                title="本类候选基金总数（含同一策略的其它份额）；榜单每个策略只保留规模最大的一个份额"
              >
                （候选 {fmtInt(detail.universe_size)} 只含份额）
              </span>
            ) : null}
          </span>
          <span
            className="num text-[26px] font-semibold"
            style={{
              color:
                detail.score === null
                  ? "var(--fg-subtle)"
                  : detail.score >= 70
                    ? "var(--pass)"
                    : detail.score >= 45
                      ? "var(--accent)"
                      : "var(--warn)",
            }}
          >
            {detail.score === null ? "—" : fmt(detail.score)}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader title="评分构成" hint={`可得因子权重 ${(detail.coverage * 100).toFixed(0)}%`} />
        <CardBody className="space-y-3 pt-4">
          {/*
            ★ 备注**始终**渲染，不只是"没有综合分"时。

            原先的条件是 `score === null && notes.length > 0` —— 于是
            "回撤数据异常，已剔除" 这类说明在一只有分的基金页面上永远看不见，
            而它恰恰是最该被看到的一类：用户看到某个因子不可用，
            却不知道那是"上游没给"还是"上游给了矛盾的数据"。
          */}
          {detail.notes.length > 0 ? (
            <div className="space-y-1.5">
              {detail.notes.map((note) => (
                <p
                  key={note}
                  className="rounded-lg border border-warn/25 bg-warn-bg px-3 py-2 text-[11.5px] leading-5 text-fg-muted"
                >
                  {note}
                </p>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3 lg:grid-cols-4">
            {specs.map((spec) => (
              <FactorRow
                key={spec.key}
                spec={spec}
                score={byKey.get(spec.key)}
                missing={detail.missing.includes(spec.key)}
                notApplicable={na.get(spec.key) ?? ""}
              />
            ))}
          </div>
          <p className="border-t border-line/70 pt-2.5 text-[11px] leading-4.5 text-fg-subtle">
            百分位是<strong className="text-fg-muted">同类内</strong>的相对位置，
            不是跨类别可比的绝对质量。「数据缺失」表示该因子适用但本批次未取到；
            「不适用」表示该指标对本基金本就没有意义（如成立年限不足）。
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="持有人结构"
          hint={
            detail.context.holders.holder_count !== null
              ? `${fmtInt(detail.context.holders.holder_count)} 户持有人`
              : "未披露"
          }
        />
        <CardBody className="space-y-3 pt-4">
          {detail.context.holders.institutional_ratio !== null ? (
            <HolderBar
              institutional={detail.context.holders.institutional_ratio}
              retail={detail.context.holders.retail_ratio}
            />
          ) : (
            <p className="text-[12px] text-fg-subtle">
              该基金未披露机构持有比例，无法判断持有人结构。
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[10.5px] text-fg-subtle">机构持有</dt>
              <dd className="num text-[12px] font-medium">
                {detail.context.holders.institutional_ratio === null
                  ? "未披露"
                  : `${detail.context.holders.institutional_ratio.toFixed(2)}%`}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[10.5px] text-fg-subtle">个人持有</dt>
              <dd className="num text-[12px] font-medium">
                {detail.context.holders.retail_ratio === null
                  ? "未披露"
                  : `${detail.context.holders.retail_ratio.toFixed(2)}%`}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[10.5px] text-fg-subtle">持有人户数</dt>
              <dd className="num text-[12px] font-medium">
                {detail.context.holders.holder_count === null
                  ? "未披露"
                  : `${fmtInt(detail.context.holders.holder_count)} 户`}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-[10.5px] text-fg-subtle">户均持有份额</dt>
              <dd className="num text-[12px] font-medium">
                {detail.context.holders.avg_holding_shares === null
                  ? "未披露"
                  : detail.context.holders.avg_holding_shares.toFixed(0)}
              </dd>
            </div>
          </dl>

          {detail.context.holders.has_concentrated_risk ? (
            <p className="rounded-lg border border-warn/25 bg-warn-bg px-3 py-2 text-[11.5px] leading-5 text-fg-muted">
              机构持有比例已越过 <strong className="text-fg">20%</strong> 的监管披露线。
              按《公开募集证券投资基金信息披露管理办法》，报告期内单一投资者持有
              达到或超过 20% 时，管理人须披露其类别、占比及本基金特有风险 ——
              也就是说监管本身认为这会影响你的投资决策。
              机构集中赎回时，剩余持有人要承担被迫卖出的交易成本与价格冲击。
            </p>
          ) : null}

          <p className="border-t border-line/70 pt-2.5 text-[10.5px] leading-4 text-fg-subtle">
            <strong className="text-fg-muted">机构占比高本身不是缺点</strong> ——
            机构资金往往更耐心。本模型只在一种极端情形下排除基金：
            机构持有 ≥95% <strong className="text-fg-muted">且</strong>持有人 &lt;2000 户，
            那意味着这只基金在结构上是某一家机构的专用通道，而不是公开产品
            （其「业绩」往往是那家机构自己的资金安排，你既买不到也赎不回）。
            两个条件必须同时满足：机构占比 100% 但持有人 84 万户，
            是面向大众的机构基金，不该被排除。
          </p>
        </CardBody>
      </Card>

      {smoothness ? (
        <Card>
          <CardHeader
            title="逐年收益"
            hint="判断「业绩是否平滑」的直接证据"
          />
          <CardBody className="space-y-3 pt-4">
            <p className="text-[11.5px] leading-5 text-fg-subtle">
              只看累计收益会被<strong className="text-fg-muted">单年爆发</strong>误导 ——
              一只五年里四年在亏钱、靠一年行情拉高累计收益的基金，
              其业绩并不反映管理能力。下面把每年拆开看：
              <strong className="text-fg-muted">柱子越参差，业绩越不稳</strong>。
            </p>
            <YearlyReturns
              years={smoothness.years}
              labels={smoothness.year_labels ?? []}
              worst={smoothness.worst}
              spread={smoothness.spread}
            />
            <p className="border-t border-line/70 pt-2.5 text-[10.5px] leading-4 text-fg-subtle">
              逐年收益由<strong className="text-fg-muted">嵌套的累计收益</strong>相除得到
              （上游只提供累计值，但「近1年」是「近2年」的子区间，相邻两期相除即还原单年收益）。
              窗口固定为最近 5 年 —— 所有候选基金用同一窗口，
              否则「最差的一年」跨基金不可比。
            </p>
            <p className="text-[10.5px] leading-4 text-fg-subtle">
              横轴<strong className="text-fg-muted">左边是最近的一年</strong>，向右依次回溯；
              标注的是每个滚动 12 个月窗口的<strong className="text-fg-muted">结束年份</strong>
              {smoothness.window_end ? `（最近一年截至 ${fmtDate(smoothness.window_end)}）` : ""}，
              不是自然年 —— 上游没有按自然年切分的收益序列，
              逐年值也无法与基金平台的「年度收益」直接对照。
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="各期原始值" hint="榜单上只放得下百分位，判断时需要看数字" />
          <CardBody className="pt-4">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-line/70">
                  <th className="micro py-2 text-left font-medium">期间</th>
                  <th className="micro py-2 text-right font-medium">累计复权收益</th>
                  <th className="micro py-2 text-right font-medium">最大回撤</th>
                </tr>
              </thead>
              <tbody>
                {["1", "3", "5", "10"].map((years) => {
                  const ret = cumulative[years];
                  const dd = drawdowns[years];
                  if (ret === undefined && dd === undefined) return null;
                  return (
                    <tr key={years} className="border-b border-line/40 last:border-0">
                      <td className="py-2 text-fg-muted">{PERIOD_LABELS[years]}</td>
                      <td className="num py-2 text-right">
                        {ret === undefined ? "—" : `${fmt(ret)}%`}
                      </td>
                      <td className="num py-2 text-right">
                        {dd === undefined ? (
                          rejectedDrawdowns[years] !== undefined ? (
                            <span
                              className="text-[10.5px] text-fail"
                              title={`上游报告 ${fmt(rejectedDrawdowns[years])}%，该值结构性不可能，已剔除`}
                            >
                              数据异常
                            </span>
                          ) : (
                            "—"
                          )
                        ) : (
                          <span className="text-warn">{fmt(dd)}%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-[10.5px] leading-4 text-fg-subtle">
              累计收益为<strong>复权</strong>口径（含分红）。未复权口径会系统性低估分红基金 ——
              实测同批基金中最大差 8.34 个百分点 / 3 年。
            </p>
            {Object.keys(rejectedDrawdowns).length > 0 ? (
              <p className="mt-1.5 text-[10.5px] leading-4 text-fail">
                标为「数据异常」的期间：上游返回值与其它期间自相矛盾
                （如超过该类别的结构上限，或比更短窗口的回撤还小），
                已剔除、不参与评分。悬停可看原始值。
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="持仓结构"
            hint={
              detail.holdings.length > 0
                ? `前十大重仓 · 合计占净值 ${detail.context.top10_weight?.toFixed(1) ?? "—"}%`
                : "无持仓数据"
            }
          />
          <CardBody className="space-y-3 pt-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-line/70 pb-3 text-[12px]">
              <Field
                label="成立年限"
                value={`${detail.age_years.toFixed(1)} 年`}
              />
              <Field
                label="基金规模"
                value={detail.size === null ? "—" : `${(detail.size / 1e8).toFixed(1)} 亿`}
              />
              <Field
                label="股票仓位"
                value={
                  detail.context.equity_ratio === null
                    ? "不可得"
                    : `${detail.context.equity_ratio.toFixed(1)}%`
                }
              />
              <Field
                label="持仓加权覆盖"
                value={`${(detail.context.holdings_coverage * 100).toFixed(0)}%`}
              />
            </dl>

            {detail.holdings.length === 0 ? (
              <p className="text-[11.5px] leading-5 text-fg-subtle">
                该基金没有股票持仓数据 —— 纯债基金持有债券，
                本项目的个股评分不适用，因此也不参与持仓类因子。
                这是<strong className="text-fg-muted">本就不适用</strong>，不是数据缺失。
              </p>
            ) : (
              <ul className="space-y-1">
                {detail.holdings.map((item) => (
                  <li
                    key={`${item.rank}-${item.stock_name}`}
                    className="flex items-baseline justify-between gap-3 text-[12px]"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="num w-5 shrink-0 text-[10.5px] text-fg-subtle">
                        {item.rank}
                      </span>
                      <span className="truncate">{item.stock_name}</span>
                      {item.stock_code ? (
                        // 持仓个股几乎都不在本站收录范围内（一只基金持仓几十只，
                        // 站点只发布两个市场的前若干名）—— 只有真收录了才给链接。
                        published.has(item.stock_code) ? (
                          <Link
                            href={`/stocks/${item.stock_code}`}
                            className="num shrink-0 text-[10.5px] text-fg-subtle underline decoration-dotted underline-offset-2 hover:text-accent"
                          >
                            {item.stock_code}
                          </Link>
                        ) : (
                          <span className="num shrink-0 text-[10.5px] text-fg-subtle">
                            {item.stock_code}
                          </span>
                        )
                      ) : null}
                    </span>
                    <span className="num shrink-0 text-[11.5px]">
                      {item.weight === null ? "—" : `${item.weight.toFixed(2)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-line/70 pt-2.5 text-[10.5px] leading-4 text-fg-subtle">
              持仓来自基金<strong className="text-fg-muted">季报</strong>，
              最长可能滞后约四个月，期间基金完全可能已调仓。
              持仓类因子只基于能匹配到本站个股评分的持仓计算，
              覆盖率不足时该因子不取数、由其余因子重新归一权重。
            </p>
          </CardBody>
        </Card>
      {detail.share_members.length > 0 ? (
        <Card>
          <CardHeader
            title="份额说明"
            hint={`该基金共 ${detail.share_group_size} 个份额`}
          />
          <CardBody className="space-y-2 pt-4">
            <p className="text-[12px] leading-5 text-fg-muted">
              同一只基金的其它份额已被<strong className="text-fg">合并到本行</strong>
              （持仓完全相同，只是费率结构不同）。榜单只保留规模最大的份额作代表：
            </p>
            <ul className="num space-y-1 text-[12px] text-fg-subtle">
              {detail.share_members.map((code) => (
                <li key={code}>
                  {/*
                    ★ 被合并的份额**必然**不在榜单里（榜单只保留规模最大的
                    那个作代表），所以这里原本的链接是 100% 的 404。
                    渲染成纯文本并说明原因，而不是留一个点了会碎的入口。
                  */}
                  {published.has(code) ? (
                    <Link
                      href={`/funds/${code}`}
                      className="underline decoration-dotted underline-offset-2 hover:text-accent"
                    >
                      {code}
                    </Link>
                  ) : (
                    code
                  )}
                </li>
              ))}
            </ul>
            <p className="border-t border-line/70 pt-2.5 text-[10.5px] leading-4 text-fg-subtle">
              被合并的份额不在榜单上，因此多数没有可打开的详情页；
              查它们的历史净值请用基金销售平台按代码检索。
            </p>
            <p className="border-t border-line/70 pt-2.5 text-[10.5px] leading-4 text-fg-subtle">
              选哪个份额取决于<strong className="text-fg-muted">你的持有期限与渠道</strong>：
              A 类收申购费、适合长期持有；C 类收销售服务费、适合短期。
              本模型不对此做判断 —— 去重只是为了不让同一只基金重复占位。
            </p>
          </CardBody>
        </Card>
      ) : null}

      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[10.5px] text-fg-subtle">{label}</dt>
      <dd className={cn("num text-[12px] font-medium")}>{value}</dd>
    </div>
  );
}
