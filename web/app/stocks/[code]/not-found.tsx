import Link from "next/link";

import { Card, EmptyState } from "@/components/ui/primitives";

/** 标的不存在。原因通常是代码拼错或不在最新批次中 —— 两者都要说明。 */
export default function StockNotFound() {
  return (
    <Card>
      <EmptyState
        title="未找到该标的"
        hint={
          <>
            可能的原因：代码拼写有误，或该标的不在最新数据批次中。
            <br />
            用 <kbd className="num rounded border border-line/70 bg-surface px-1.5 py-0.5 text-[11px]">⌘K</kbd>{" "}
            搜索代码或名称，或先运行一次 ETL 刷新快照。
          </>
        }
        action={
          <Link
            href="/screener"
            className="rounded-xl border border-line/70 px-4 py-2 text-[13px] font-medium transition-colors hover:bg-surface-hover"
          >
            返回筛选器
          </Link>
        }
      />
    </Card>
  );
}
