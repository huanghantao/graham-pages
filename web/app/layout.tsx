import type { Metadata } from "next";

import { AppFooter } from "@/components/shell/app-footer";
import { AppHeader } from "@/components/shell/app-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "格雷厄姆工作台",
    template: "%s · 格雷厄姆工作台",
  },
  description:
    "面向 A股 / 港股的低估值价值投资工作台。每个数字都可溯源到具体查询，并携带数据可信度审计结论。",
};

/**
 * 首帧前应用主题的内联脚本。
 *
 * 必须在 `<head>` 中同步执行：若等 React 水合后再设置，
 * 暗色用户会看到一瞬间的白屏闪烁（FOUC）。
 */
const THEME_SCRIPT = `(function(){try{
var stored=localStorage.getItem("graham-theme")||"system";
var dark=stored==="dark"||(stored==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.dataset.theme=dark?"dark":"light";
}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <AppHeader />
        <main className="mx-auto w-full max-w-[80rem] px-4 py-7 sm:px-6 sm:py-9">
          {children}
        </main>
        <AppFooter />
      </body>
    </html>
  );
}
