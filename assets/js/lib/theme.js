function applyTheme(mode, themeToggle, themeSelect) {
  document.body.classList.remove("dark", "theme-outrunner", "theme-vaporwave");
  if (mode === "dark") document.body.classList.add("dark");
  else if (mode === "outrunner") document.body.classList.add("theme-outrunner");
  else if (mode === "vaporwave") document.body.classList.add("theme-vaporwave");

  if (themeSelect) themeSelect.value = mode;
  if (themeToggle) {
    const isDark = mode === "dark";
    themeToggle.textContent = isDark ? "Light" : "Dark";
    themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
  }
}

function initTheme(themeToggle, themeSelect) {
  let mode = "light";
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light" || saved === "outrunner" || saved === "vaporwave") {
      mode = saved;
    } else {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      mode = prefersDark ? "dark" : "light";
    }
  } catch {}
  applyTheme(mode, themeToggle, themeSelect);
  return mode;
}

export function setupTheme(themeToggle, themeSelect, onThemeChange) {
  const current = initTheme(themeToggle, themeSelect);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = document.body.classList.contains("dark") ? "light" : "dark";
      applyTheme(next, themeToggle, themeSelect);
      try { localStorage.setItem("theme", next); } catch {}
      onThemeChange(next);
    });
  }
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      const mode = themeSelect.value || "light";
      applyTheme(mode, themeToggle, themeSelect);
      try { localStorage.setItem("theme", mode); } catch {}
      onThemeChange(mode);
    });
  }

  return { current, applyTheme: (mode) => applyTheme(mode, themeToggle, themeSelect) };
}