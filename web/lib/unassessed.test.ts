/**
 * `unassessed` 的单元测试。
 *
 * ```bash
 * cd web && node --test lib/unassessed.test.ts
 * ```
 *
 * 钉住的是三类在页面上"看起来没坏"的错误：缺键被当成异常、盲区数量与
 * 指标集合对不上、以及无盲区时仍然渲染出一个空徽标。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  isMetricUnassessed,
  missingLabelFor,
  unassessedLabel,
  unassessedTooltip,
} from "./unassessed.ts";
import type { UnassessedSignal } from "@/lib/types";

const spot = (overrides: Partial<UnassessedSignal> = {}): UnassessedSignal => ({
  code: "0026.HK",
  signal: "hk_share_untradeable",
  severity: "high",
  title: "几乎无法交易",
  missing_metric: "avg_turnover_20d",
  missing_label: "近20日日均成交额",
  ...overrides,
});

test("缺键与空数组都视为无盲区", () => {
  assert.equal(isMetricUnassessed({}, "avg_turnover_20d"), false);
  assert.equal(isMetricUnassessed({ unassessed_signals: [] }, "avg_turnover_20d"), false);
  assert.equal(unassessedLabel({}), null);
});

test("按指标匹配，与信号条数无关", () => {
  const row = {
    unassessed_signals: [
      spot(),
      spot({ signal: "hk_share_thin_liquidity", title: "流动性稀薄" }),
    ],
  };
  assert.equal(isMetricUnassessed(row, "avg_turnover_20d"), true, "两条信号共用同一指标");
  assert.equal(isMetricUnassessed(row, "price"), false);
});

test("缺失指标的中文名取自载荷，界面不另存词表", () => {
  const row = {
    unassessed_signals: [
      spot(),
      spot({ signal: "hk_share_gem_board", missing_metric: "board", missing_label: "板块" }),
    ],
  };
  assert.equal(missingLabelFor(row, "avg_turnover_20d"), "近20日日均成交额");
  assert.equal(missingLabelFor(row, "board"), "板块");
  // 该指标没缺失 → undefined，调用方据此退回普通空值渲染
  assert.equal(missingLabelFor(row, "price"), undefined);
  assert.equal(missingLabelFor({}, "avg_turnover_20d"), undefined);
});

test("徽标只给数量，且无盲区时不渲染", () => {
  assert.equal(unassessedLabel({ unassessed_signals: [] }), null);
  assert.equal(unassessedLabel({ unassessed_signals: [spot()] }), "未复核 1 项");
});

test("数量与信号条数一致（不按指标去重）", () => {
  // 两只信号共用同一个缺失指标，页面上要如实说 2 项 —— 用户数的是条目。
  const row = {
    unassessed_signals: [
      spot(),
      spot({ signal: "hk_share_thin_liquidity", title: "流动性稀薄" }),
    ],
  };
  assert.equal(unassessedLabel(row), "未复核 2 项");
});

test("提示逐条说明缺的是哪个指标", () => {
  const row = {
    unassessed_signals: [
      spot(),
      spot({
        signal: "hk_share_gem_board",
        severity: "info",
        title: "创业板",
        missing_metric: "board",
        missing_label: undefined,
      }),
    ],
  };
  assert.equal(
    unassessedTooltip(row),
    "几乎无法交易（缺少「近20日日均成交额」）\n创业板（缺少「board」）",
  );
});

test("无盲区时没有提示（避免浏览器显示空 tooltip）", () => {
  assert.equal(unassessedTooltip({}), undefined);
});
