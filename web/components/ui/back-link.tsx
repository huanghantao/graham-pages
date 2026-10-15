import Link from "next/link";

/**
 * 返回上一级列表的入口。
 *
 * ## 为什么必须有
 *
 * 详情页（个股、基金）此前**没有任何返回列表的链接** —— 实测两个页面
 * 内部链接里都没有指向 `/funds` / `/stocks` 的入口。
 * 用户从榜单点进详情后，只能靠浏览器后退键回去；
 * 而手机端从通知/分享直接打开详情页时，**根本没有"上一页"可退**。
 *
 * 导航栏里的「基金」虽然能点，但它是**平级导航**而非"回到刚才那个列表" ——
 * 而且会丢掉列表上的筛选与滚动位置。详情页需要一个语义明确的返回入口。
 *
 * ## 为什么用普通链接而不是 `router.back()`
 *
 * `history.back()` 在直接打开详情页（外部链接、刷新后）时会跳出本站，
 * 或什么都不做。而"回到列表"这个意图是确定性的 —— 用一个明确的
 * 链接比依赖历史栈更可靠，也让用户可以中键/长按在新标签打开。
 */
export function BackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="-ml-1.5 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12px] text-fg-subtle transition-colors hover:text-accent"
    >
      <span aria-hidden className="text-[13px] leading-none">
        ←
      </span>
      回到{label}
    </Link>
  );
}
