/**
 * 展示层格式化。
 *
 * 集中在一处的原因：**"数值为空时显示什么"是一个产品决定，不是实现细节**。
 * 散落在各组件里会导致同一个后端字段在不同页面显示成 "—" / "-" / "" / "N/A"。
 *
 * 特别地：`null` 一律显示为"—"（U+2014 破折号，比连字符更不易误读为负号）。
 * 这是刻意的 —— 财务表里 `-` 与数字的负号容易混淆。
 */

const DASH = "—";

export function fmt(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 整数（用于股数、只数等） */
export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return Math.round(value).toLocaleString("zh-CN");
}

/** 入参是比率（0.75 → "75%"） */
export function fmtRatio(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return DASH;
  return `${(value * 100).toFixed(digits)}%`;
}

/** 入参已是百分数（5.22 → "5.22%"） */
export function fmtPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return DASH;
  return `${value.toFixed(digits)}%`;
}

/** 带方向符号（用于溢价、增长率） */
export function fmtSigned(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return DASH;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

/**
 * 币种的**基本单位名**。
 *
 * 刻意**不做汇率换算**：本站没有可靠的实时汇率来源，
 * 用近似汇率把港元折成人民币会引入一个用户看不见的误差 ——
 * 那正是本项目反复在修的"静默偏差"。
 * 因此改为**显式标注币种**，把"跨市场金额不可直接相加"这件事
 * 摆在用户面前，而不是替他做一个可能错的换算。
 */
const CURRENCY_BASE: Record<string, string> = {
  cny: "元",
  hkd: "港元",
  usd: "美元",
};

function baseUnit(currency?: string | null): string {
  return CURRENCY_BASE[(currency ?? "cny").toLowerCase()] ?? "";
}

/**
 * 金额按量级智能缩放，并带上币种。
 *
 * 财务数据跨 8 个数量级（从千元到万亿），固定单位会让小数字全变成 0.0。
 * 因此按量级选择单位，并在 UI 上始终显示单位（不做"隐含万元"这种约定）。
 *
 * Args:
 *   value: 金额。
 *   digits: 小数位。
 *   currency: 币种（`cny` / `hkd`）。**必须传**，否则港股金额会被当成人民币 ——
 *     实测腾讯总市值 3.87 万亿港元曾显示为「3.87 万亿元」，偏差约 8%。
 */
export function fmtMoney(
  value: number | null | undefined,
  digits = 1,
  currency?: string | null,
): string {
  if (value === null || value === undefined) return DASH;
  const base = baseUnit(currency);
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(digits)} 万亿${base}`;
  if (abs >= 1e8) return `${(value / 1e8).toFixed(digits)} 亿${base}`;
  if (abs >= 1e4) return `${(value / 1e4).toFixed(digits)} 万${base}`;
  return `${value.toFixed(digits)} ${base}`.trim();
}

/** 金额（不含单位，用于表格中已声明单位的列） */
export function fmtMoneyBare(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${(value / 1e8).toFixed(1)}`;
  if (abs >= 1e4) return `${(value / 1e4).toFixed(1)}`;
  return value.toFixed(0);
}

/** 由金额决定该列的单位标签（含币种） */
export function moneyUnit(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (value === null || value === undefined) return "";
  const base = baseUnit(currency);
  const abs = Math.abs(value);
  if (abs >= 1e12) return `万亿${base}`;
  if (abs >= 1e8) return `亿${base}`;
  if (abs >= 1e4) return `万${base}`;
  return base;
}

/** 日期：2026-10-13 → 2026/10/13 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  return iso.replaceAll("-", "/");
}

/** 年份：2025-12-31 → 2025 */
export function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

export { DASH };

/**
 * 确定性的字符串比较（按 Unicode 码点）。
 *
 * **不要用 `localeCompare`**：它的结果依赖运行环境的 ICU 排序规则，
 * 因此 Node（服务端渲染）与浏览器（水合）可能给出不同顺序 ——
 * 这会触发 React 的 hydration mismatch，而且只在特定语言环境下复现，
 * 极难排查。排序的确定性优先于"符合语言习惯"。
 *
 * 若未来确实需要按拼音排序，必须显式传入 locale 并在两端保持一致。
 */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
