"use client";

/** 主题切换：亮 / 暗 / 跟随系统。选择写入 localStorage，首帧前由内联脚本应用。 */

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "graham-theme";

function apply(theme: Theme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = resolved;
}

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "亮色", icon: "☀" },
  { value: "dark", label: "暗色", icon: "☾" },
  { value: "system", label: "跟随系统", icon: "⌥" },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setTheme(stored);
    setMounted(true);
  }, []);

  const change = (next: Theme) => {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  };

  // 跟随系统时，系统主题变化需要同步
  useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => apply("system");
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [theme]);

  return (
    <div
      role="radiogroup"
      aria-label="主题"
      className="flex items-center gap-0.5 rounded-lg border border-line/70 bg-surface p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={mounted && theme === option.value}
          title={option.label}
          onClick={() => change(option.value)}
          className={cn(
            "rounded-[6px] px-1.5 py-1 text-[13px] leading-none transition-colors",
            mounted && theme === option.value
              ? "bg-bg-elevated text-fg shadow-card"
              : "text-fg-subtle hover:text-fg-muted",
          )}
        >
          <span aria-hidden>{option.icon}</span>
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
