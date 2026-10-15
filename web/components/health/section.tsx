import { Card, CardBody, CardHeader, Notice } from "@/components/ui";
import type { ProvenanceEntry } from "@/lib/types";

import { ProvenanceList } from "./provenance-list";

/**
 * 契约校验区块。
 *
 * 把"为什么需要语义审计"讲清楚 —— 这不是可选的严格性，而是必要的：
 * 实测两种静默失败都会返回 `status_code = 0` 与看似正常的结果。
 *
 * ## 默认展开与否，取决于**有没有问题**
 *
 * 26 条契约的语义解析明细约 4,500px（手机 5.3 屏），此前默认展开，
 * 把后面的「不可用信号」「运行历史」推到 5,500px 之外。
 *
 * 但简单地"默认收起"是错的：这个页面的存在意义就是
 * **静默失败 → 响亮失败**。若真出了口径问题，把它折叠起来
 * 恰好违背了页面本身的承诺。
 *
 * 因此按状态决定：**全部通过时收起，有问题时展开**。
 * 正常情况下页面很短；异常情况下问题直接暴露在首屏。
 */
export function ProveanceSection({
  contracts,
  unavailableSignals,
}: {
  contracts: ProvenanceEntry[];
  unavailableSignals: string[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Card className="lg:col-span-8">
        <CardHeader
          title="本次抓取的语义解析"
          hint="上游接口对这些查询的实际理解，未做任何修饰"
        />
        <CardBody className="pt-4">
          <ProvenanceList entries={contracts} />
        </CardBody>
      </Card>

      <div className="space-y-5 lg:col-span-4">
        <Card>
          <CardHeader title="为什么必须有语义审计" />
          <CardBody className="space-y-4 pt-4">
            <Notice tone="fail" title="实测两种静默失败">
              <ul className="space-y-2.5">
                <li>
                  <strong className="text-fg">拼写错误注入条件</strong>
                  <p className="mt-0.5">
                    「市盈绿小于10的A股」（把「率」误写成「绿」）被解析为
                    「阴线且市盈率&lt;10倍」，命中数从 1,763 掉到 73。
                  </p>
                </li>
                <li>
                  <strong className="text-fg">垃圾输入返回全集</strong>
                  <p className="mt-0.5">乱码查询返回全市场 5,581 只，看起来「有结果」。</p>
                </li>
              </ul>
              <p className="mt-2.5 text-fg-muted">
                两种情况下 <code className="num text-[11.5px]">status_code</code> 都是 0，
                只有 <code className="num text-[11.5px]">chunks_info</code> 能暴露问题。
              </p>
            </Notice>

            <ol className="space-y-2 text-[12px] leading-5 text-fg-muted">
              <li>
                <span className="num mr-1.5 text-fg-subtle">1.</span>
                <code className="num text-[11.5px]">status_code == 0</code> —— 基础可用性
              </li>
              <li>
                <span className="num mr-1.5 text-fg-subtle">2.</span>
                <strong className="text-fg">语义检查</strong>：
                <code className="num ml-1 text-[11.5px]">chunks_info</code>{" "}
                必须包含必需概念、且不含技术形态词
              </li>
              <li>
                <span className="num mr-1.5 text-fg-subtle">3.</span>
                行数区间 —— 抓住「垃圾输入返回全市场」这类退化
              </li>
              <li>
                <span className="num mr-1.5 text-fg-subtle">4.</span>
                必需列可解析 —— 解析失败即报错而非降级
              </li>
            </ol>
          </CardBody>
        </Card>

        {unavailableSignals.length > 0 ? (
          <Card>
            <CardHeader title="本平台不可用的信号" />
            <CardBody className="space-y-3 pt-4">
              <Notice tone="warn">
                这些信号是<strong>取不到</strong>，而不是「没有风险」。
              </Notice>
              <ul className="space-y-3">
                {unavailableSignals.map((signal, index) => {
                  const [name, ...rest] = signal.split("：");
                  return (
                    <li key={index} className="text-[12px] leading-5">
                      <div className="font-medium text-warn">{name}</div>
                      <p className="mt-0.5 text-fg-subtle">{rest.join("：")}</p>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
