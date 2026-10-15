/**
 * 极简 className 组合工具。
 *
 * 不引入 clsx/tailwind-merge：本项目的类名组合场景简单（条件拼接，
 * 不存在同类属性覆盖冲突），一个 15 行的实现足够，且零依赖。
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
