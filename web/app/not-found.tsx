import Link from "next/link";

import { Card, CardBody } from "@/components/ui";

/**
 * 404 页面。
 *
 * ## 为什么必须自己写
 *
 * Next.js 的默认 404 是英文的（"This page could not be found."），
 * 而本站其余部分全中文 —— 一个中文产品里突然出现英文，
 * 用户会怀疑"是不是我自己搞错了什么"。而且默认页**没有任何返回入口**，
 * 用户只能手动改地址栏。
 *
 * ## 为什么列出常用入口而不是只说"没找到"
 *
 * 404 的成因几乎总是**地址过期或手输错**（基金/股票代码是
 * 数字加后缀，很容易记错）。既然用户本意是想看某只标的，
 * 与其让他自己想"我该去哪"，不如直接给几个入口。
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card>
        <CardBody className="space-y-4 py-10 text-center">
          <p className="num text-[44px] font-semibold leading-none text-fg-subtle">404</p>
          <h1 className="text-[17px] font-semibold tracking-tight">没有找到这个页面</h1>
          <p className="mx-auto max-w-md text-[12.5px] leading-6 text-fg-muted">
            可能是代码输错了，或这个标的已不在当前快照里。
            快照只包含通过契约校验的数据；某只标的被排除，
            通常是因为它的关键字段不完整（例如缺少资产负债表），
            而不是它不存在。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {[
              { href: "/", label: "市场温度计" },
              { href: "/screener", label: "个股" },
              { href: "/funds", label: "基金榜" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-line/70 px-3 py-1.5 text-[12.5px] text-fg-muted transition-colors hover:bg-surface"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <p className="pt-2 text-[11px] text-fg-subtle">
            要找某只标的？用右上角的搜索（⌘K）
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
