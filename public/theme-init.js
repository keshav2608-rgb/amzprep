// Apply the saved theme before first paint to avoid a light/dark flash.
try {
  document.documentElement.dataset.theme = localStorage.getItem("leetcode_theme_v1") || "light";
} catch (e) {
  /* storage unavailable: keep the default theme */
}
