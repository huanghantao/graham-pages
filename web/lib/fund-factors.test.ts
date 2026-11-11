/**
 * `fund-factors` 的单元测试。
 *
 * 用 Node 自带的测试运行器跑，因此**不引入任何依赖**：
 *
 * ```bash
 * cd web && node --test lib/fund-factors.test.ts
 * ```
 *
 * 这里刻意逐个钉住边界值。"同类前 0%" / "同类前 100%" 这类表述不会让
 * 类型检查失败、也不会让构建失败，只会在页面上读起来莫名其妙，
 * 所以只能靠断言把它们挡住。
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { FundFactorSpec } from "@/lib/types";
import {
  factorTone,
  formatWeight,
  peerStanding,
  weightComposition,
} from "./fund-factors.ts";

/** 构造一份因子声明，只写关心的字段。 */
function spec(
  key: string,
  weight: number,
  overrides: Partial<FundFactorSpec> = {},
): FundFactorSpec {
  return {
    key,
    label: key,
    weight,
    direction: "higher_better",
    min_age_years: 0,
    categories: [],
    description: "",
    display_unit: "%",
    ...overrides,
  };
}

test("peerStanding：中位以上说「前」，且与百分位互补", () => {
  assert.deepEqual(peerStanding(82), { side: "top", label: "同类前 18%" });
  assert.deepEqual(peerStanding(50), { side: "top", label: "同类前 50%" });
  assert.deepEqual(peerStanding(99), { side: "top", label: "同类前 1%" });
});

test("peerStanding：中位以下说「后」，数字是比自己好的占比", () => {
  assert.deepEqual(peerStanding(49), { side: "bottom", label: "同类后 49%" });
  assert.deepEqual(peerStanding(30), { side: "bottom", label: "同类后 30%" });
  assert.deepEqual(peerStanding(3), { side: "bottom", label: "同类后 3%" });
});

test("peerStanding：两端不会被舍入成 0%", () => {
  // 第一名：better = 0，四舍五入会得到 0 —— 必须抬到 1。
  assert.deepEqual(peerStanding(100), { side: "top", label: "同类前 1%" });
  // 中位秩公式下实际不会取到 100，最靠前约 99.84（n=322）。
  assert.deepEqual(peerStanding(99.84), { side: "top", label: "同类前 1%" });
  // 最后一名：beaten = 0，同样必须抬到 1。
  assert.deepEqual(peerStanding(0), { side: "bottom", label: "同类后 1%" });
  assert.deepEqual(peerStanding(0.16), { side: "bottom", label: "同类后 1%" });
});

test("peerStanding：越界与非有限值被收敛，不产生 NaN", () => {
  assert.deepEqual(peerStanding(150), { side: "top", label: "同类前 1%" });
  assert.deepEqual(peerStanding(-30), { side: "bottom", label: "同类后 1%" });
  assert.deepEqual(peerStanding(Number.NaN), { side: "top", label: "同类前 50%" });
});

test("factorTone：阈值落在百分位上，边界两侧分属不同档", () => {
  assert.equal(factorTone(100), "good");
  assert.equal(factorTone(70), "good");
  assert.equal(factorTone(69.9), "fair");
  assert.equal(factorTone(40), "fair");
  assert.equal(factorTone(39.9), "poor");
  assert.equal(factorTone(0), "poor");
});

test("factorTone：坏值按中位处理", () => {
  assert.equal(factorTone(Number.NaN), "fair");
  assert.equal(factorTone(Number.POSITIVE_INFINITY), "fair");
});

test("formatWeight：整数百分点", () => {
  assert.equal(formatWeight(0.16), "16%");
  assert.equal(formatWeight(0.02), "2%");
  assert.equal(formatWeight(0), "0%");
  assert.equal(formatWeight(1), "100%");
});

test("formatWeight：越界值被收敛到 0%~100%", () => {
  assert.equal(formatWeight(1.5), "100%");
  assert.equal(formatWeight(-0.5), "0%");
  assert.equal(formatWeight(Number.NaN), "0%");
});

test("weightComposition：份量之和恒为 100", () => {
  const shares = weightComposition([
    spec("a", 0.16),
    spec("b", 0.17),
    spec("c", 0.05),
    spec("d", 0.62),
  ]);
  const total = shares.reduce((sum, item) => sum + item.share, 0);
  assert.ok(Math.abs(total - 100) < 1e-9, `合计应为 100，实际 ${total}`);
});

test("weightComposition：按份量降序，最大的因子排在最前", () => {
  const shares = weightComposition([
    spec("small", 0.04),
    spec("large", 0.17),
    spec("medium", 0.11),
  ]);
  assert.deepEqual(
    shares.map((item) => item.spec.key),
    ["large", "medium", "small"],
  );
});

test("weightComposition：权重未配平时按实际合计归一，条形仍铺满", () => {
  // 三项都是 0.5，合计 1.5 —— 按假定的 1 归一会算出 50%+50%+50% = 150%。
  const shares = weightComposition([spec("a", 0.5), spec("b", 0.5), spec("c", 0.5)]);
  const total = shares.reduce((sum, item) => sum + item.share, 0);
  assert.ok(Math.abs(total - 100) < 1e-9, `合计应为 100，实际 ${total}`);
  assert.ok(shares.every((item) => Math.abs(item.share - 100 / 3) < 1e-9));
});

test("weightComposition：没有权重时不输出构成", () => {
  assert.deepEqual(weightComposition([]), []);
  assert.deepEqual(weightComposition([spec("a", 0), spec("b", 0)]), []);
});

test("weightComposition：脏权重不会让份量变成负值或 NaN", () => {
  const shares = weightComposition([
    spec("good", 0.5),
    spec("negative", -0.2),
    spec("nan", Number.NaN),
  ]);
  // 负值与非有限值都收敛为 0 份量，因此排在最后；两者等价，
  // 由稳定排序保持声明的先后顺序。
  assert.deepEqual(
    shares.map((item) => item.spec.key),
    ["good", "negative", "nan"],
  );
  assert.ok(shares.every((item) => Number.isFinite(item.share) && item.share >= 0));
  assert.equal(shares[0]?.share, 100);
  assert.equal(shares[1]?.share, 0);
});
