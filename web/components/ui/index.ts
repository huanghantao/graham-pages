/**
 * UI 组件统一出口。
 *
 * 分成两类是有意的：
 * - `primitives.tsx` 是**服务端组件**（零客户端 JS），用于纯展示；
 * - `interactive.tsx` / `disclosure.tsx` 是**客户端组件**（`"use client"`），
 *   用于需要状态的交互。
 *
 * 调用方一律从 `@/components/ui` 引入，无需知道某个组件属于哪一类 ——
 * 这样将来把某个组件在两者之间迁移时，不需要改任何调用点。
 */

export * from "./primitives";
export * from "./interactive";

// 折叠区块。用原生 `<details>`，本身无状态，但需要跟随主题样式。
export * from "./disclosure";

// 数据展示原语：把数值编码为可视化形式（背景条、点阵），
// 是表格可扫读性的关键，因此与通用容器一起放在 ui 层。
export { ScoreCell, CoverageDots } from "./score-cell";
export { DeltaCell } from "./delta";
export { BottomSheet, FloatingFilterButton } from "./drawer";

// 浮层必须经 portal 渲染，否则 fixed 定位会被带 transform 的祖先捕获。
export { Portal } from "./portal";
