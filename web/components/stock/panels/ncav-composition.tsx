"use client";

/**
 * NCAV 构成质量。
 *
 * ## 为什么需要这一块
 *
 * 账面 NCAV（流动资产 − 总负债）**没有说明安全边际的质量**。
 * 两家 NCAV 相同的公司，一家流动资产几乎全是现金、另一家几乎全是存货，
 * 处境完全不同：前者随时可变现，后者的"价值"取决于能不能把货卖出去。
 *
 * ## 为什么不做"调整 NCAV"
 *
 * 实务上常见给应收账款、存货各打一个折扣再加总的做法。本项目**刻意不做**：
 *
 * 1. 格雷厄姆本人指出清算价值无法准确估算
 *    （"The analyst cannot calculate accurately the liquidating value..."）；
 * 2. 折扣率高度依赖行业与存货性质 —— 同一个"存货打五折"用在白酒企业与
 *    服装企业上，一个过于保守、一个过于乐观。给全市场统一折扣率是**虚假的精确**。
 *
 * 因此这里只提供两样**不需要任何假设**的东西：
 * 事实性构成比例，以及一个纯减法的更严口径（剔除存货的 NCAV）。
 */

import { fmtMoney } from "@/lib/format";
import type { NcavComposition as Composition } from "@/lib/types";

/** 构成分段：键、中文名、颜色。顺序即"变现能力由强到弱"。 */
const SEGMENTS = [
  { key: "cash_share", label: "现金及等价物", color: "var(--pass)" },
  { key: "receivables_share", label: "应收账款", color: "var(--accent)" },
  { key: "inventory_share", label: "存货", color: "var(--warn)" },
  { key: "other_share", label: "其他流动资产", color: "var(--fg-subtle)" },
] as const;

export function NcavComposition({
  composition,
  currency = "cny",
}: {
  composition: Composition;
  currency?: string;
}) {
  if (composition.current_assets === null) return null;

  const shares = SEGMENTS.map((segment) => ({
    ...segment,
    share: (composition[segment.key] ?? 0) as number,
    value: composition[segment.key.replace("_share", "") as "cash"] as number | null,
  }));

  return (
    <div className="space-y-3">
      {/*
        构成**完整**时才画比例条。
        缺任一科目时残差会把缺失算进去（如把缺失的"货币资金"当成 0），
        得到错误的占比 —— 宁可少显示，也不显示错的。

        但注意：下面两块（剔除存货的 NCAV、依赖存货的警示）**与构成是否完整无关** ——
        它们只用到 `流动资产 / 存货 / 总负债` 三个数，都独立可得。
        早期版本在构成不完整时直接 return，把这两块一起藏掉了 ——
        而对"存货撑起的净网股"（如嘉创地产：存货 9.2 亿 / 流动资产 11.7 亿，
        剔除后 NCAV 由 +6.08 亿转为 −3.12 亿），这恰恰是**唯一重要的事实**。
      */}
      {composition.complete ? (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="micro">流动资产构成</span>
            <span className="num text-[11.5px] text-fg-subtle">
              {fmtMoney(composition.current_assets, 1, currency)}
            </span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface">
            {shares.map((segment) =>
              segment.share > 0.001 ? (
                <div
                  key={segment.key}
                  style={{ width: `${segment.share * 100}%`, background: segment.color }}
                  title={`${segment.label} ${(segment.share * 100).toFixed(1)}%`}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {shares.map((segment) => (
              <li key={segment.key} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: segment.color }}
                  />
                  <span className="truncate text-[11px] text-fg-muted">{segment.label}</span>
                </span>
                <span className="num shrink-0 text-[11px] tabular-nums">
                  {(segment.share * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-line/70 bg-surface/60 px-2.5 py-2">
          <p className="text-[11px] leading-4 text-fg-subtle">
            构成比例不可用：缺少
            <span className="text-fg-muted"> {composition.missing_components.join("、")} </span>
            科目。本项目不展示不完整的构成 —— 残差项会把缺失科目计入，
            得到错误的占比，那比不显示更糟。
            <span className="mt-1 block text-fg-muted">
              但下方的「剔除存货的 NCAV」仍有效：它只用到流动资产、存货、总负债三个数。
            </span>
          </p>
        </div>
      )}

      {/* 更严口径：纯减法，不引入任何折扣假设 */}
      <div className="border-t border-line/70 pt-3">
        <div className="flex items-baseline justify-between">
          <span className="micro" title="(流动资产 − 存货) − 总负债">
            剔除存货的 NCAV
          </span>
          <span
            className="num text-[13px] font-medium"
            style={{
              color:
                composition.ncav_ex_inventory !== null &&
                composition.ncav_ex_inventory > 0
                  ? "var(--pass)"
                  : "var(--fg-subtle)",
            }}
          >
            {fmtMoney(composition.ncav_ex_inventory, 1, currency)}
          </span>
        </div>
        <p className="mt-1 text-[10.5px] leading-4 text-fg-subtle">
          （流动资产 − 存货）− 总负债。这是减法而非折扣 ——
          口径可被逐项复核，不引入任何主观系数。
        </p>
      </div>

      {/* 事实判定：存货一卖不掉就没有安全边际 */}
      {composition.relies_entirely_on_inventory ? (
        <div className="rounded-xl border border-warn/30 bg-warn-bg px-3 py-2.5">
          <p className="text-[12px] font-medium text-warn">安全边际完全依赖存货</p>
          <p className="mt-1 text-[11px] leading-4.5 text-fg-muted">
            剔除存货后 NCAV 即降至 0 以下，而它账面上仍是净网股 ——
            也就是说这份「便宜」的兑现完全取决于存货能否按账面卖出。
            存货是流动资产中变现能力最弱的一项，房地产、服装、电子元器件
            的存货在清算时的实际价值与其账面可以相差极大。
            请自行判断这类存货的真实变现能力 —— 本项目不给折扣率，
            那会把一个凭空的数字伪装成计算结果。
          </p>
        </div>
      ) : null}
    </div>
  );
}
