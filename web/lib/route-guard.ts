/**
 * 路由门禁 —— 把「这个表面在当前档案下存不存在」变成一次显式调用。
 *
 * ## 为什么门禁要写在页面里，而不是藏在数据层
 *
 * 让数据读取函数在产物缺失时顺手 `notFound()` 看似更省事，但它把
 * **导航语义**塞进了**数据访问**：读取失败的原因有很多（还没发布、
 * 文件损坏、路径写错），把它们一律变成 404 会让排查失去线索。
 *
 * 门禁写在页面首行则意图明确：**这一页在当前档案下不存在**。
 * "不许忘记调用"由契约测试保证（扫描每个受门禁保护的路由）。
 *
 * ## 为什么它产生的是真 404 而不是一个"不可用"提示页
 *
 * 静态导出时 `notFound()` 会让 Next **根本不生成该路由的产物**
 * （已实测：`out/` 下没有对应目录）。因此 GitHub Pages 返回的是真正的
 * HTTP 404，而不是"200 + 一页写着不提供"。后者仍然等于把页面留在了站上。
 */

import { notFound } from "next/navigation";

import { hasCapability, type Capability } from "./ui-profile";

/**
 * 断言当前档案具备某项能力，否则 404。
 *
 * ★ 必须在服务端组件的**渲染期**调用：静态导出时这决定了该路由是否产出
 * 文件；`next dev` 下则渲染 not-found 界面。两者行为一致 —— 页面不存在。
 *
 * Args:
 *   capability: 需要的能力。取值与 `ui-profiles.json` 的产物扣留表对应。
 */
export function requireCapability(capability: Capability): void {
  if (!hasCapability(capability)) {
    notFound();
  }
}
