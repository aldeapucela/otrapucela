export function throttle(callback, waitMs) {
  let lastCallTime = 0;
  let timeoutId = null;
  let lastArgs = [];

  function throttled(...args) {
    const now = Date.now();
    const remainingTime = waitMs - (now - lastCallTime);
    lastArgs = args;

    if (remainingTime <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      lastCallTime = now;
      callback(...lastArgs);
      return;
    }

    if (!timeoutId) {
      timeoutId = window.setTimeout(() => {
        lastCallTime = Date.now();
        timeoutId = null;
        callback(...lastArgs);
      }, remainingTime);
    }
  }

  throttled.flush = function flush() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastCallTime = Date.now();
      callback(...lastArgs);
    }
  };

  return throttled;
}

export function debounce(callback, waitMs) {
  let timeoutId = null;

  return function debounced(...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      callback(...args);
    }, waitMs);
  };
}

export function safelyReadLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safelyWriteLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in privacy-restricted contexts.
  }
}

export function safelyRemoveLocalStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors in privacy-restricted contexts.
  }
}

export function safelyReadJsonFromLocalStorage(key) {
  const rawValue = safelyReadLocalStorage(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeHtmlAttribute(value) {
  return escapeHtml(String(value ?? ""));
}

export function normalizePathname(value) {
  if (!value) {
    return "/";
  }

  try {
    const url = new URL(value, window.location.origin);
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    const normalizedValue = String(value).trim();
    return normalizedValue.replace(/\/+$/, "") || "/";
  }
}

export function formatReadingListDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short"
  }).format(date);
}
