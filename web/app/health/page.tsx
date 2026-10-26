import { ProveanceSection } from "@/components/health/section";
import { BackLink } from "@/components/ui/back-link";
import { Badge, Card, CardBody, CardHeader, EmptyState, Stat } from "@/components/ui";
import { getDataHealth, getManifest } from "@/lib/snapshot";
import { MARKET_UTC_OFFSET_LABEL, fmtInt, fmtTimestamp } from "@/lib/format";
import type { TrustLevel } from "@/lib/types";

export const metadata = { title: "数据可信度" };

const TRUST_META: Record<TrustLevel, { label: string; tone: "pass" | "warn" | "fail" }> = {
  trusted: { label: "可信", tone: "pass" },
  degraded: { label: "降级可用", tone: "warn" },
  untrusted: { label: "不可信", tone: "fail" },
};

/**
 * 数据可信度看板。
 *
 * 为什么要有这一页：上游接口对无法理解的查询**不会报错**，而是返回一个
 * 看起来正常的结果。因此本站对每次抓取都执行契约校验，并把结论公开。
 * 页面的存在本身就是一种产品声明：**静默失败 → 响亮失败**。
 */
export default async function HealthPage() {
  // 运行条数在发布时就已固化（`graham publish` 固定取 30 条）——
  // 静态站点上没有"按需多取几页"这回事。
  const health = await getDataHealth();
  // 生成时刻取自 manifest 的 `data_generated_at`（**带时区的 UTC**），
  // 而不是运行历史里的 `finished_at` —— 后者是库里的本地裸值，
  // 在构建机（CI 为 UTC）上按 `new Date()` 解析会被当成本机时间，
  // 显示出来的时刻会整体偏移一次时区。
  const generatedAt = getManifest()?.data_generated_at ?? null;

  if (!health) {
    return (
      <Card>
        <EmptyState
          title="尚无可用快照"
          hint="本站是静态站点，数据来自发布时生成的快照 —— 请重新运行发布流程。"
        />
      </Card>
    );
  }

  const { latest, history, unavailable_signals } = health;

  return (
    <div className="animate-rise space-y-5">
      {/* 本页已移出主导航（运维视角，不属于投资决策主线）。
          从页脚或数据提示条进来时需要一个明确的返回目标 ——
          这里回到首页，也就是决策路径的起点。 */}
      <BackLink href="/" label="温度计" />

      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">数据可信度</h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-6 text-fg-muted">
          上游接口对无法理解的查询<strong className="text-fg">不会报错</strong>
          ，而是返回一个看起来正常的结果。因此每次抓取都执行契约校验，
          并把结论如实公开在这里。
        </p>
      </div>

      {latest ? (
        <Card>
          <CardHeader
            title="最新批次"
            hint={latest.summary}
            action={
              <Badge tone={TRUST_META[latest.trust_level].tone}>
                {TRUST_META[latest.trust_level].label}
              </Badge>
            }
          />
          <CardBody className="pt-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <Stat label="快照日" value={latest.as_of} size="sm" />
              <Stat
                label="契约通过"
                value={`${latest.contracts_passed}/${latest.contracts_total}`}
                size="sm"
                tone={latest.contracts_passed === latest.contracts_total ? "pass" : "fail"}
              />
              <Stat label="标的" value={fmtInt(latest.security_count)} size="sm" />
              <Stat label="观测" value={fmtInt(latest.observation_count)} size="sm" />
            </div>
            <p className="mt-4 text-[12.5px] text-fg-muted">
              数据生成于{" "}
              <span className="num text-fg">{fmtTimestamp(generatedAt)}</span>
              <span className="ml-1">（{MARKET_UTC_OFFSET_LABEL}）</span>
            </p>
            {!latest.allows_scoring ? (
              <div className="mt-4 rounded-xl border border-fail/30 bg-fail-bg px-3.5 py-2.5 text-[12.5px] text-fail">
                该批次未通过关键契约校验，<strong>已停止用于打分</strong>。
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <ProveanceSection contracts={health.contracts} unavailableSignals={unavailable_signals} />

      <Card>
        <CardHeader title="运行历史" hint={`近 ${history.length} 次`} />
        <CardBody className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr className="border-b border-line/70">
                  {["快照日", "状态", "可信度", "契约", "标的", "观测", "摘要"].map((head) => (
                    <th key={head} className="micro px-3 py-2.5 text-left font-medium">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((run) => (
                  <tr key={run.run_id} className="border-b border-line/40 last:border-0">
                    <td className="num px-3 py-2 text-[12.5px]">{run.as_of}</td>
                    <td className="px-3 py-2 text-[12px]">
                      {run.status === "succeeded" ? "成功" : run.status === "failed" ? "失败" : "运行中"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={TRUST_META[run.trust_level].tone}>
                        {TRUST_META[run.trust_level].label}
                      </Badge>
                    </td>
                    <td className="num px-3 py-2 text-[12.5px]">
                      {run.contracts_passed}/{run.contracts_total}
                    </td>
                    <td className="num px-3 py-2 text-right text-[12.5px]">
                      {fmtInt(run.security_count)}
                    </td>
                    <td className="num px-3 py-2 text-right text-[12.5px]">
                      {fmtInt(run.observation_count)}
                    </td>
                    <td className="px-3 py-2 text-[11.5px] text-fg-subtle">
                      {run.summary.slice(0, 40)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
