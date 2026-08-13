(function () {
  try {
    if (localStorage.getItem("theme") === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) {}
})();

function toggleTheme() {
  var root = document.documentElement;
  var isDark = root.getAttribute("data-theme") === "dark";
  if (isDark) {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", "dark");
  }
  try {
    localStorage.setItem("theme", isDark ? "light" : "dark");
  } catch (e) {}
  var btn = document.getElementById("theme-toggle");
  if (btn) btn.setAttribute("aria-pressed", isDark ? "false" : "true");
}

document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("theme-toggle");
  if (btn) {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
  }
});
