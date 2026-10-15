/**
 * 数据批次状态提示条（服务端组件）。
 *
 * ## 为什么这条必须永远存在
 *
 * 只要数据不是「完全可信且新鲜」，这条提示就必须出现 ——
 * 数据有问题时不提示，比数据有问题本身更糟。
 *
 * ## 但为什么它**刻意做得轻**
 *
 * 常驻的大卡片会让用户产生**告警疲劳**，反而忽略真正严重的情形。
 * 因此默认只有一行高度，用颜色与一句话区分严重度。
 *
 * ## 它要说清三件事，而它们的性质完全不同
 *
 * | 状态 | 时长 | 对用户的意义 |
 * |---|---|---|
 * | **抓取中** | ~110 秒（瞬时） | 「稍等，数据正在更新」 |
 * | **快照陈旧** | 天/周（持续） | 「结论可能已过期」 |
 * | **抓取失败** | 到下次成功 | 「数据没更新，原因在此」 |
 *
 * 早期版本只表达「可信度」（trust_level），于是有一个真实的误导：
 * ETL 抓取期间 `latest_run()` 会跳过 `running` 批次、回退到上一次成功，
 * 而各页面显示的是「尚无数据，请先运行 ETL」——
 * **而 ETL 正在运行**。这是个明确的假陈述，也是本项目最反对的失败模式。
 *
 * ## 为什么必须显示「落后 N 天」而不是只显示日期
 *
 * 用户看到「快照 2026-10-14」无法判断它是 1 天前还是 1 周前（不会去心算），
 * 更不知道这个差距是否正常（跨周末落后 2 天正常，落后 6 天不正常）。
 *
 * 新鲜度由**服务端**判定（见 `domain/freshness.py`），前端只负责展示 ——
 * 判定逻辑含「长假」这类领域知识，不该散落在视图层。
 */

import Link from "next/link";

import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";
import type { DataStatus, TrustLevel } from "@/lib/types";

const TRUST_META: Record<TrustLevel, { label: string; className: string }> = {
  trusted: { label: "可信", className: "border-pass/30 bg-pass-bg text-pass" },
  degraded: { label: "降级可用", className: "border-warn/30 bg-warn-bg text-warn" },
  untrusted: { label: "不可信", className: "border-fail/30 bg-fail-bg text-fail" },
};

export function RunNotice({
  status,
  message,
}: {
  /**
   * 数据批次状态。
   *
   * ``null`` 表示**服务端明确说了没有批次**；``undefined`` 表示
   * 这个字段没被提供（例如前后端版本不一致）。两者必须区分 ——
   * 见下方 ``statusKnown`` 的说明。
   */
  status: DataStatus | null | undefined;
  /** 页面级的补充说明（如温度计的「非当日」文案）。 */
  message?: string;
}) {
  const run = status?.run ?? null;
  const freshness = status?.freshness ?? null;

  /*
    ★ 区分「明确没有数据」与「没被告知状态」。

    组件**不应对自己没被告知的事下断言**。早期实现只看 ``!run`` 就渲染
    「尚无数据快照，请先运行 ETL」—— 而实测这种"假消息"真的发生了：
    后端尚未更新（响应里没有 ``status`` 字段）时，
    基金数据明明在正常显示，提示条却在说"尚无数据快照"。

    这与本次修复要解决的原始问题**是同一类缺陷**：
    界面把"我不知道"说成了"没有"。因此这里显式区分：
    * ``status === null``（服务端明确回复无批次）→ 说"尚无数据快照"
    * ``status === undefined``（字段缺失）→ 不渲染任何断言
  */
  const statusKnown = status !== undefined;

  // ── 无任何成功批次 ──────────────────────────────────────
  if (!run) {
    if (!statusKnown) return null; // 不知道状态时保持沉默，而不是编一句
    const updating = status?.is_updating ?? false;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warn/30 bg-warn-bg px-3.5 py-2.5 text-[12.5px]">
        <span className="font-medium text-warn">
          {updating ? "正在抓取首批数据" : "尚无数据快照"}
        </span>
        <span className="text-fg-muted">
          {updating ? (
            /* 抓取中的请求不该被说成「请先运行 ETL」—— 那与事实相反 */
            <>首次抓取正在进行，约需 1~2 分钟。完成后刷新本页即可看到结果。</>
          ) : (
            <>
              请先运行
              <code className="num mx-1 rounded border border-line/70 bg-surface px-1.5 py-0.5 text-[11.5px]">
                python -m graham.cli etl
              </code>
              生成快照
            </>
          )}
        </span>
        <StatusLink />
      </div>
    );
  }

  const meta = TRUST_META[run.trust_level];
  const stale = freshness?.level === "stale";
  const quiet = run.trust_level === "trusted" && !freshness?.needs_attention && !stale;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3.5 py-2.5 text-[12.5px]",
        quiet ? "border-line/70 bg-surface" : stale ? "border-fail/30 bg-fail-bg" : meta.className,
      )}
    >
      <span
        className={cn(
          "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
          meta.className,
        )}
      >
        {meta.label}
      </span>

      {/* 抓取中：瞬时状态，用最轻的方式表达（一个脉冲点 + 一句话） */}
      {status?.is_updating ? (
        <span className="flex items-center gap-1.5 font-medium text-accent">
          <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
          正在抓取新数据
        </span>
      ) : null}

      <span className="num text-fg-muted">
        快照 {run.as_of}
        {/* 落后天数直接给出 —— 用户不会去心算日期差 */}
        {freshness?.age_days === null || freshness?.age_days === undefined
          ? ""
          : freshness.age_days > 0
            ? `（${freshness.age_days} 天前）`
            : "（今日）"}
      </span>

      <span className="num text-fg-subtle">
        契约 {run.contracts_passed}/{run.contracts_total} · 标的{" "}
        {fmtInt(run.security_count)} · 观测 {fmtInt(run.observation_count)}
      </span>

      {message ? <span className="text-fg-muted">{message}</span> : null}

      {!run.allows_scoring ? (
        <span className="w-full font-medium">
          该批次未通过关键契约校验，<strong>已停止用于打分</strong>。
        </span>
      ) : null}

      {/*
        陈旧提示：区分「确定异常」与「可能是长假」。
        服务端在 4~14 天区间刻意**不下断言**（我们分不清长假与故障），
        文案因此只说事实 —— 把判断留给用户。
      */}
      {freshness?.needs_attention ? (
        <span className={cn("w-full", stale ? "text-fail" : "text-warn")}>
          {freshness.message}
        </span>
      ) : null}

      {/* 失败提示：只有「晚于最近成功」的失败才影响当前数据 */}
      {status?.failed_after_latest && status.failed ? (
        <span className="w-full text-fail">
          最近一次抓取（{status.failed.as_of}）失败
          {status.failed.summary ? `：${status.failed.summary}` : ""} —— 当前展示的仍是
          {run.as_of} 的数据。
        </span>
      ) : null}

      <StatusLink />
    </div>
  );
}

/** 指向数据可信度页的链接。状态详情都在那里。 */
function StatusLink() {
  return (
    <Link
      href="/health"
      className="ml-auto shrink-0 whitespace-nowrap underline decoration-dotted underline-offset-2 hover:text-fg-muted"
    >
      数据可信度 →
    </Link>
  );
}
