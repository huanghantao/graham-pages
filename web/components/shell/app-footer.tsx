import Link from "next/link";

import { hasCapability, type Capability } from "@/lib/ui-profile";

/**
 * 全站页脚。
 *
 * ## 为什么把「数据可信度」放在这里而不是主导航
 *
 * 主导航原本有 6 项，其中「数据可信度」（原「数据健康」）本质是
 * **运维视角** —— 它回答的是「这批抓取的数据能不能信」，
 * 内容契约数、观测数、语义解析明细、运行历史。
 *
 * 而其余 5 项构成一条**投资决策主线**：
 *
 * .. code-block:: text
 *
 *     温度计（现在该投吗）→ 策略（现成的名单）
 *       → 个股（自己筛）→ 基金（另一种载体）
 *       → 方法论（凭什么信）
 *
 * 把运维项混在这条线里，会让主导航看起来像"功能菜单"而不是"决策路径"。
 * 移到页脚后主导航聚焦主线，而需要查数据状态的人（以及任何想验证
 * 本站是否在如实披露的人）仍能从每一页的页脚进入。
 *
 * ## 为什么「方法论」不在导航，也不在这里
 *
 * 方法论页已从本站移除。它不是文档附录，而是一份讲**判据口径与出处**
 * 的说明 —— 它和策略页一样最容易被读成"该怎么投"，
 * 而本项目明确不提供投资建议。
 *
 * 「数据可信度」与之不同：它回答的是"这批数据能不能信"（契约校验结论、
 * 已知不可用信号），面向的是**验证者**而不是想找标的的人。正常用户不需要
 * 每天看，但它必须能被找到 —— 所以它在页脚，并且**只在页脚**。
 *
 * ## 可达性保证
 *
 * 移出导航的页面**必须有稳定的入口**，否则会变成孤儿页。
 * 这里保证两件事：
 *
 * 1. 页脚在**每一页**都渲染（挂在 root layout 上）；
 * 2. `tests/unit/test_frontend_contracts.py::TestEveryPageIsReachable`
 *    断言每个路由都能从导航或页脚到达 —— 新增页面若忘了加链接就会失败。
 *
 * ## 为什么没有「自动化」入口
 *
 * 静态导出下不存在服务端：那一页是**写配置**的（改抓取档期、改通知渠道），
 * 需要 Server Actions 与写接口鉴权，两者都与纯静态托管互斥。
 * 保留它会得到一个"能打开、能提交、但提交必然失败"的页面 ——
 * 而"看起来正常"的失败正是本项目最想消灭的东西。
 *
 * 定时抓取与通知渠道改由命令行管理（`graham schedule` /
 * `GRAHAM_FEISHU_WEBHOOK`），那是它们本来就该待的地方：
 * 只有部署者本人需要，公开站点上没有它们的读者。
 *
 * ## 与主导航同源
 *
 * 页脚入口同样按档案过滤（`:data:`FOOTER_LINKS`` 每项声明所需能力），
 * 理由与 app-header 相同：**入口与页面必须由同一个开关派生**。
 */
interface FooterLink {
  href: string;
  label: string;
  hint: string;
  capability?: Capability;
}

const FOOTER_LINKS: readonly FooterLink[] = [
  { href: "/health", label: "数据可信度", hint: "契约校验与已知不可用信号" },
  {
    href: "/methodology",
    label: "方法论",
    hint: "判据出处与已知局限",
    capability: "methodology",
  },
  {
    href: "/publish",
    label: "发布",
    hint: "把快照与源码同步到公开站仓库",
    // 运维动作，与「数据可信度」同类：只有部署者本人需要，因此放页脚。
    // 它还需要服务端（要起子进程、写外部仓库），公开档案下连页面都不存在。
    capability: "publishing",
  },
];

const VISIBLE_FOOTER_LINKS = FOOTER_LINKS.filter(
  (item) => item.capability === undefined || hasCapability(item.capability),
);

export function AppFooter() {
  return (
    <footer className="mt-20 border-t border-line/70">
      <div className="mx-auto max-w-[80rem] px-4 py-7 sm:px-6">
        {/*
          页脚导航做成**按钮尺寸**（≥40px 高），而不是小文字链接。
          实测初版链接只有 61×18px，远低于可用的触控目标 ——
          而「数据可信度」移出主导航后，这里就是它在手机上的**主要入口**，
          不该是难以点中的小字。
        */}
        <nav
          aria-label="页脚导航"
          className="flex flex-wrap items-center gap-2 pb-4"
        >
          {VISIBLE_FOOTER_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.hint}
              className="inline-flex items-center rounded-lg border border-line/70 px-3 py-2 text-[12.5px] text-fg-muted transition-colors hover:bg-surface hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-line/50 pt-4 text-[11.5px] leading-5 text-fg-subtle">
          <p>
            数据取自第三方接口；每个数字都可溯源到具体查询，解析记录与契约校验
            结论公开在
            <Link
              href="/health"
              className="mx-1 underline decoration-dotted underline-offset-2 hover:text-fg-muted"
            >
              数据可信度
            </Link>
            页面。
          </p>
          {/*
            ★ 这里**刻意不写数据来源的名字**。

            披露与否由**数据**决定，而不是由这个组件里的条件分支决定：
            快照按档案裁剪（工作台保留接口标识与厂商名，公开档案抹除），
            界面只负责把存在的东西渲染出来。原因很实际 —— 厂商名一旦写进
            源码，公开仓库的源码里就又有它了，而那是要避免的。
          */}
          {/*
            免责声明放在页脚而不是做成一个单独页面：它必须在**每一页**
            可见，而不是需要用户主动去找。措辞刻意比一般项目更硬 ——
            本站会输出个股评分、排名与「建议权益仓位」，这类内容在境内
            属于需持牌的证券投资咨询业务范畴，因此必须把边界说死：
            ① 不是投资建议；② 数据取自第三方且不担保准确；③ 禁止用于持牌业务。
          */}
          <p className="rounded-md border border-line/60 bg-surface/40 px-3 py-2">
            <strong className="font-medium text-fg-muted">
              不构成投资建议。
            </strong>
            本站输出为数据整理与展示，不是荐股工具；数据取自第三方，
            可能错误、缺失或失效，不作准确性担保。
            <span className="block pt-1">
              本站是<strong className="font-medium text-fg-muted">静态站点</strong>：
              页面在发布时一次生成，数据是
              <strong className="font-medium text-fg-muted">某个快照日</strong>
              的定格，不是实时行情，也不会随访问更新。
              收录范围只覆盖每个市场排名靠前的部分标的。
            </span>
            <span className="block pt-1">
              历史与统计结果不代表未来表现，其中必然包含后续下跌的标的。
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
