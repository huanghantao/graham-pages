"use client";

/**
 * 浮层挂载点（portal）。
 *
 * 为什么必须用 portal
 * ------------------
 * 浮层组件（抽屉、命令面板、侧边面板）依赖 ``position: fixed`` 定位到视口。
 * 但 ``position: fixed`` **只在祖先没有建立包含块时才相对视口定位** ——
 * 而以下任一祖先都会建立包含块：

 * - 带 ``transform``（含动画）的元素
 * - 带 ``filter`` / ``backdrop-filter`` / ``perspective`` 的元素
 * - ``contain: paint``
 *
 * 本应用几乎所有页面容器都带 ``animate-rise``（入场动画含 transform），
 * 因此浮层会被"钉"在那个容器上而不是视口上 —— 实测浮动筛选按钮的
 * ``getBoundingClientRect().y`` 返回 **47390**（页面总高约 47000px），
 * 即它被定位到了文档底部，用户永远看不到。
 *
 * 把浮层渲染到 ``document.body`` 下可彻底规避这类问题，同时也顺带
 * 解决层叠上下文（z-index）被祖先限制的问题。这是浮层组件的标准做法。
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // 必须等挂载后才能访问 document（服务端渲染没有 document）。
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(children, document.body);
}
