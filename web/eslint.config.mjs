import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

/**
 * ESLint 扁平配置（flat config）。
 *
 * 为什么需要这个文件
 * ------------------
 * `package.json` 里一直写着 `"lint": "next lint"`，但仓库里**没有任何
 * ESLint 配置**。后果不是"少了一层检查"，而是更糟：任何人执行 `pnpm lint`
 * 都会掉进 Next.js 的**交互式安装向导**，在 CI 里则直接失败。也就是说这个
 * 脚本此前从未真正跑过。
 *
 * 为什么用 FlatCompat 而不是直接 extends 字符串
 * ---------------------------------------------
 * `eslint-config-next` 目前仍以 eslintrc 格式分发（`next/core-web-vitals`
 * 等），而 ESLint 9 默认只认扁平配置。`FlatCompat` 是官方提供的桥接层，
 * 避免为了迁就旧格式而把 ESLint 锁在 v8。
 *
 * 忽略项说明
 * ----------
 * `.next/` 与 `out/` 都是构建产物：前者是开发构建，后者是静态导出
 * （`output: "export"`）的成品。对它们跑 lint 只会淹出几千条针对打包器
 * 生成代码的告警，把真正的源码问题埋掉 —— 实测 `out/` 未忽略时报出
 * 2,664 条问题，其中没有一条来自源码。
 *
 * `public/data/` 是快照数据（`graham publish` 的产物），不是源码。
 *
 * `next-env.d.ts` 由 Next.js 自动生成且明确要求不要手改，对它跑 lint
 * 只会产生无法修复的告警。
 */
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "public/data/**",
      "node_modules/**",
      "next-env.d.ts",
      "next.config.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;