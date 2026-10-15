/**
 * 部署基础路径。
 *
 * GitHub Pages 的项目页挂在 `https://<user>.github.io/<repo>/` 下，
 * Next.js 会用 `basePath` 自动处理页面路由与 `_next` 静态资源 ——
 * **但不会**自动处理手写的 `fetch()`。
 *
 * 实测症状很隐蔽：首页一切正常，只有 ⌘K 的索引请求 404 —— 因为
 * `basePath` 只作用于框架生成的 URL。故这里显式拼一次。
 *
 * 变量名必须与 `next.config.ts` 里的那个完全一致（都是
 * `NEXT_PUBLIC_BASE_PATH`），否则两处会分叉：一处认为站点在 `/graham-pages`、
 * 另一处认为在根，结果是资源正常而取数全挂。
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** 把站点内的绝对路径补上 basePath。 */
export function withBasePath(absolutePath: string): string {
  if (!BASE_PATH) return absolutePath;
  return `${BASE_PATH}${absolutePath.startsWith("/") ? "" : "/"}${absolutePath}`;
}
