export function setupThemeToggle() {
  const themeToggleBtns = document.querySelectorAll('.js-theme-toggle');

  if (!themeToggleBtns.length) {
    return;
  }

  const updateUI = (isDark) => {
    themeToggleBtns.forEach(btn => {
      const icon = btn.querySelector('.js-theme-toggle-icon') || btn;
      const label = btn.querySelector('.js-theme-toggle-label') || document.querySelector('.js-theme-toggle-label');

      if (icon && icon.classList.contains('js-theme-toggle-icon')) {
        if (isDark) {
          icon.classList.remove('fa-moon');
          icon.classList.add('fa-sun');
        } else {
          icon.classList.remove('fa-sun');
          icon.classList.add('fa-moon');
        }
      }

      if (label) {
        label.textContent = isDark ? 'Modo claro' : 'Modo oscuro';
      }
    });
  };

  // Determinar estado actual basado en clase HTML que fue inyectada en el <head>
  const isDarkInitial = document.documentElement.classList.contains('dark');
  updateUI(isDarkInitial);

  function notifyDiscourseTheme(isDark) {
    const iframe = document.getElementById("discourse-embed-frame") ??
      document.querySelector('iframe[id^="discourse-embed"]');
    if (!iframe) return;
    try {
      iframe.contentWindow.postMessage(
        { type: "discourse-theme", colorScheme: isDark ? "dark" : "light" },
        "*"
      );
    } catch (_) {}
  }

  themeToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      const nextDark = !isDark;

      if (nextDark) {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
      }

      updateUI(nextDark);
      notifyDiscourseTheme(nextDark);
      document.dispatchEvent(new CustomEvent("discourse-theme-changed"));
    });
  });

  // Escuchar cambios del sistema si el usuario no tiene preferencia guardada
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!('theme' in localStorage)) {
      const nextDark = e.matches;
      if (nextDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      updateUI(nextDark);
      notifyDiscourseTheme(nextDark);
    }
  });
}
