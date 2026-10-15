/** Tailwind v4 通过 PostCSS 插件接入，无需 tailwind.config.js。 */
const config = {
  plugins: { "@tailwindcss/postcss": {} },
};

// 用具名变量再导出：匿名默认导出在栈追踪里显示为 <anonymous>，
// 排查 PostCSS 插件报错时定位不到是哪个配置文件。
export default config;
