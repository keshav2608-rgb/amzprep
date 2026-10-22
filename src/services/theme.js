// Light/dark theme. The initial theme is applied by an inline script in index.html to avoid a flash.

const THEME_KEY = "leetcode_theme_v1";

export function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch {}
}
