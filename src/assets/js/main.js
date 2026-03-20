function throttle(callback, waitMs) {
  let lastCallTime = 0;
  let timeoutId = null;
  let lastArgs = [];

  return function throttled(...args) {
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
  };
}

function debounce(callback, waitMs) {
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

function setupHeaderAutoHide() {
  const headerElement = document.querySelector("#js-header");

  if (!headerElement) {
    return;
  }

  let lastScrollY = window.scrollY;

  const handleScroll = throttle(() => {
    const currentScrollY = window.scrollY;
    const isScrollingDown = currentScrollY > lastScrollY;
    const hasPassedThreshold = currentScrollY > 50;

    if (isScrollingDown && hasPassedThreshold) {
      headerElement.classList.add("-translate-y-full");
    } else {
      headerElement.classList.remove("-translate-y-full");
    }

    lastScrollY = currentScrollY;
  }, 100);

  window.addEventListener("scroll", handleScroll, { passive: true });
}

function setupPwaRegistration() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

function setupInstallPrompt() {
  const triggerElement = document.querySelector(".js-install-app-trigger");
  const descriptionElement = document.querySelector(".js-install-app-description");
  const dialogElement = document.querySelector("[data-install-dialog]");

  if (!triggerElement || !dialogElement) {
    return;
  }

  const closeButtons = dialogElement.querySelectorAll("[data-install-close]");
  const copyElement = dialogElement.querySelector(".js-install-dialog-copy");
  const stepsElement = dialogElement.querySelector(".js-install-steps");
  const confirmButton = dialogElement.querySelector(".js-install-app-confirm");
  const confirmLabel = dialogElement.querySelector(".js-install-app-confirm-label");
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  let deferredPrompt = null;
  let mode = null;

  function closeDialog() {
    if (dialogElement.open) {
      dialogElement.close();
    }

    document.body.classList.remove("overflow-hidden");
    triggerElement.focus();
  }

  function openDialog() {
    if (typeof dialogElement.showModal !== "function") {
      return;
    }

    dialogElement.showModal();
    document.body.classList.add("overflow-hidden");
  }

  function applyMode(nextMode) {
    mode = nextMode;

    if (mode === "ios") {
      triggerElement.classList.remove("hidden");
      triggerElement.classList.add("inline-flex");
      descriptionElement.textContent = "Guarda el medio como acceso directo desde Safari.";
      copyElement.textContent = "En iPhone y iPad debes hacerlo manualmente desde el menú de compartir de Safari.";
      stepsElement.innerHTML = `
        <li>1. Abre esta web en Safari.</li>
        <li>2. Pulsa el botón Compartir (cuadrado con flecha hacia arriba).</li>
        <li>3. Desplázate y toca “Añadir a pantalla de inicio”.</li>
        <li>4. Confirma el nombre y pulsa “Añadir”.</li>
      `;
      confirmLabel.textContent = "Entendido";
      return;
    }

    if (mode === "install") {
      triggerElement.classList.remove("hidden");
      triggerElement.classList.add("inline-flex");
      descriptionElement.textContent = "Instálala en tu móvil para abrirla con un toque.";
      copyElement.textContent = "Tu navegador puede añadir La Otra Pucela a la pantalla de inicio como acceso directo instalable.";
      stepsElement.innerHTML = `
        <li>1. Pulsa el botón de abajo.</li>
        <li>2. Revisa el diálogo de instalación de tu navegador.</li>
        <li>3. Confirma la instalación para añadirla a tu pantalla de inicio.</li>
      `;
      confirmLabel.textContent = "Añadir ahora";
      return;
    }

    triggerElement.classList.add("hidden");
    triggerElement.classList.remove("inline-flex");
  }

  async function handleConfirm() {
    if (mode === "install" && deferredPrompt) {
      deferredPrompt.prompt();

      try {
        await deferredPrompt.userChoice;
      } catch {
        // Ignore prompt dismissal and keep the menu action available.
      }

      deferredPrompt = null;
      closeDialog();
      applyMode(null);
      return;
    }

    closeDialog();
  }

  triggerElement.addEventListener("click", openDialog);
  confirmButton?.addEventListener("click", handleConfirm);

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeDialog);
  });

  dialogElement.addEventListener("click", (event) => {
    const dialogBounds = dialogElement.getBoundingClientRect();
    const isBackdropClick =
      event.clientX < dialogBounds.left
      || event.clientX > dialogBounds.right
      || event.clientY < dialogBounds.top
      || event.clientY > dialogBounds.bottom;

    if (isBackdropClick) {
      closeDialog();
    }
  });

  dialogElement.addEventListener("close", () => {
    document.body.classList.remove("overflow-hidden");
    triggerElement.focus();
  });

  if (isStandalone) {
    applyMode(null);
    return;
  }

  if (isIos) {
    applyMode("ios");
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    applyMode("install");
  });
}

function setupHeaderMenu() {
  const menuToggleButton = document.querySelector(".js-menu-toggle");
  const menuPanel = document.querySelector(".js-menu-panel");

  if (!menuToggleButton || !menuPanel) {
    return;
  }

  function closeMenu() {
    menuPanel.classList.add("hidden");
    menuToggleButton.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    menuPanel.classList.remove("hidden");
    menuToggleButton.setAttribute("aria-expanded", "true");
  }

  menuToggleButton.addEventListener("click", () => {
    const isExpanded = menuToggleButton.getAttribute("aria-expanded") === "true";

    if (isExpanded) {
      closeMenu();
      return;
    }

    openMenu();
  });

  document.addEventListener("click", (event) => {
    if (
      menuPanel.classList.contains("hidden")
      || menuPanel.contains(event.target)
      || menuToggleButton.contains(event.target)
    ) {
      return;
    }

    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

function normalizeSearchValue(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearchValue(value = "") {
  const normalizedValue = normalizeSearchValue(value);

  if (!normalizedValue) {
    return [];
  }

  return normalizedValue.split(" ").filter(Boolean);
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWholeWordMatch(value = "", token = "") {
  if (!value || !token) {
    return false;
  }

  const pattern = new RegExp(`(^|\\s)${escapeRegExp(token)}(?=\\s|$)`);
  return pattern.test(value);
}

function stripHtmlTags(value = "") {
  return String(value).replace(/<[^>]+>/g, " ");
}

function buildSearchDocument(article) {
  const tagsLabel = (article.tags ?? [])
    .map((tag) => tag?.name || tag?.slug || "")
    .filter(Boolean)
    .join(" ");

  const contentText = stripHtmlTags(article.contentHtml ?? "");
  const authorName = article.author?.name ?? "";

  return {
    title: normalizeSearchValue(article.title ?? ""),
    description: normalizeSearchValue(article.description ?? ""),
    excerpt: normalizeSearchValue(article.excerpt ?? ""),
    tags: normalizeSearchValue(tagsLabel),
    author: normalizeSearchValue(authorName),
    content: normalizeSearchValue(contentText)
  };
}

function splitIntoSearchSegments(value = "") {
  const source = String(value).replace(/\s+/g, " ").trim();

  if (!source) {
    return [];
  }

  return source
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function scoreSearchMatch(searchDocument, tokens) {
  let score = 0;

  for (const token of tokens) {
    let tokenScore = 0;

    if (hasWholeWordMatch(searchDocument.title, token)) {
      tokenScore = Math.max(tokenScore, 12);
    }

    if (hasWholeWordMatch(searchDocument.tags, token)) {
      tokenScore = Math.max(tokenScore, 8);
    }

    if (hasWholeWordMatch(searchDocument.author, token)) {
      tokenScore = Math.max(tokenScore, 6);
    }

    if (hasWholeWordMatch(searchDocument.description, token) || hasWholeWordMatch(searchDocument.excerpt, token)) {
      tokenScore = Math.max(tokenScore, 4);
    }

    if (hasWholeWordMatch(searchDocument.content, token)) {
      tokenScore = Math.max(tokenScore, 2);
    }

    if (tokenScore === 0) {
      return 0;
    }

    score += tokenScore;
  }

  return score;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNormalizedIndexMap(value = "") {
  const source = String(value);
  let normalizedValue = "";
  const indexMap = [];

  for (let index = 0; index < source.length; index += 1) {
    const normalizedChar = source[index]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    for (const char of normalizedChar) {
      if (/[\w\s-]/.test(char)) {
        normalizedValue += char;
        indexMap.push(index);
      } else if (char.trim() === "") {
        normalizedValue += " ";
        indexMap.push(index);
      }
    }
  }

  return {
    normalizedValue: normalizedValue.replace(/\s+/g, " "),
    indexMap
  };
}

function highlightSearchTerms(value = "", tokens = []) {
  const source = String(value);

  if (!source) {
    return "";
  }

  const { normalizedValue, indexMap } = getNormalizedIndexMap(source);
  const ranges = [];

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    const pattern = new RegExp(`(^|\\s)(${escapeRegExp(token)})(?=\\s|$)`, "g");
    let match;

    while ((match = pattern.exec(normalizedValue)) !== null) {
      const matchIndex = match.index + match[1].length;
      const start = indexMap[matchIndex];
      const end = indexMap[Math.min(matchIndex + token.length - 1, indexMap.length - 1)] + 1;

      if (typeof start === "number" && typeof end === "number" && end > start) {
        ranges.push({ start, end });
      }
    }
  }

  if (!ranges.length) {
    return escapeHtml(source);
  }

  ranges.sort((a, b) => a.start - b.start);

  const mergedRanges = [];

  for (const range of ranges) {
    const previousRange = mergedRanges[mergedRanges.length - 1];

    if (!previousRange || range.start > previousRange.end) {
      mergedRanges.push({ ...range });
      continue;
    }

    previousRange.end = Math.max(previousRange.end, range.end);
  }

  let highlighted = "";
  let cursor = 0;

  for (const range of mergedRanges) {
    highlighted += escapeHtml(source.slice(cursor, range.start));
    highlighted += `<mark class="rounded-sm bg-[#E8D7A7] px-1 py-[0.05rem] text-gray-900">${escapeHtml(source.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }

  highlighted += escapeHtml(source.slice(cursor));

  return highlighted;
}

function formatSearchDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function buildHighlightedSnippet(article, tokens) {
  const candidateSegments = [
    ...splitIntoSearchSegments(stripHtmlTags(article.contentHtml ?? "")),
    ...splitIntoSearchSegments(article.description ?? ""),
    ...splitIntoSearchSegments(article.excerpt ?? "")
  ];

  const fallbackSnippet = article.description || article.excerpt || "";

  if (!candidateSegments.length) {
    return escapeHtml(fallbackSnippet);
  }

  let bestSegment = candidateSegments[0];
  let bestScore = -1;

  for (const segment of candidateSegments) {
    const normalizedSegment = normalizeSearchValue(segment);
    let score = 0;

    for (const token of tokens) {
      if (hasWholeWordMatch(normalizedSegment, token)) {
        score += token.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestSegment = segment;
    }
  }

  if (bestScore <= 0) {
    return escapeHtml(fallbackSnippet || bestSegment);
  }

  let snippet = bestSegment.trim();
  let hasLeadingEllipsis = false;
  let hasTrailingEllipsis = false;
  const originalSnippet = snippet;

  if (snippet.length > 220) {
    const normalizedSnippet = normalizeSearchValue(snippet);
    const firstMatchIndex = tokens.reduce((matchIndex, token) => {
      const tokenIndex = normalizedSnippet.indexOf(token);

      if (tokenIndex === -1) {
        return matchIndex;
      }

      if (matchIndex === -1 || tokenIndex < matchIndex) {
        return tokenIndex;
      }

      return matchIndex;
    }, -1);

    if (firstMatchIndex > 90) {
      snippet = snippet.slice(firstMatchIndex - 70);
      hasLeadingEllipsis = true;
    }

    if (snippet.length > 220) {
      snippet = snippet.slice(0, 220).trimEnd();
      hasTrailingEllipsis = true;
    }
  }

  if (snippet !== bestSegment.trim()) {
    hasLeadingEllipsis = true;
    hasTrailingEllipsis = true;
  }

  if (originalSnippet !== snippet && !hasLeadingEllipsis) {
    hasLeadingEllipsis = true;
  }

  if (originalSnippet !== snippet && !hasTrailingEllipsis) {
    hasTrailingEllipsis = true;
  }

  hasLeadingEllipsis = true;
  hasTrailingEllipsis = true;

  if (hasLeadingEllipsis && !snippet.startsWith("…")) {
    snippet = `…${snippet}`;
  }

  if (hasTrailingEllipsis && !snippet.endsWith("…")) {
    snippet = `${snippet}…`;
  }

  return highlightSearchTerms(snippet, tokens);
}

function createSearchResultMarkup(article, tokens) {
  const title = escapeHtml(article.title ?? "");
  const snippet = buildHighlightedSnippet(article, tokens);
  const publicPath = article.publicPath ?? "#";

  const imageMarkup = article.image
    ? `
      <a href="${publicPath}" class="block overflow-hidden bg-gray-100 shadow-sm">
        <img
          src="${escapeHtml(article.image)}"
          alt="${title}"
          class="h-24 w-full object-cover sm:h-20"
          loading="lazy"
        >
      </a>
    `
    : "";
  const layoutClass = imageMarkup
    ? "grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-5"
    : "block";

  const descriptionMarkup = snippet
    ? `<p class="mt-4 text-base leading-[1.6] text-gray-600">${snippet}</p>`
    : "";

  return `
    <article class="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
      <div class="${layoutClass}">
        ${imageMarkup ? `<div>${imageMarkup}</div>` : ""}
        <div class="min-w-0">
          <h2 class="font-serif text-[1.2rem] font-semibold leading-[1.16] tracking-tight text-gray-900 sm:text-[1.32rem]">
            <a href="${publicPath}" class="transition-colors duration-200 hover:text-gray-700">${title}</a>
          </h2>
          ${descriptionMarkup}
        </div>
      </div>
    </article>
  `;
}

async function setupSearchPage() {
  const searchRoot = document.querySelector(".js-search-page");

  if (!searchRoot) {
    return;
  }

  const searchEndpoint = searchRoot.dataset.searchEndpoint;
  const formElement = document.querySelector(".js-search-form");
  const inputElement = document.querySelector(".js-search-input");
  const loadingElement = searchRoot.querySelector(".js-search-loading");
  const summaryElement = searchRoot.querySelector(".js-search-summary");
  const countElement = searchRoot.querySelector(".js-search-count");
  const queryElement = searchRoot.querySelector(".js-search-query");
  const idleElement = searchRoot.querySelector(".js-search-idle");
  const emptyElement = searchRoot.querySelector(".js-search-empty");
  const errorElement = searchRoot.querySelector(".js-search-error");
  const resultsElement = searchRoot.querySelector(".js-search-results");
  const initialQuery = new URLSearchParams(window.location.search).get("q") ?? "";
  let currentRequestId = 0;
  let articleItems = null;

  if (inputElement) {
    inputElement.value = initialQuery;
  }

  function setState(stateName) {
    idleElement?.classList.toggle("hidden", stateName !== "idle");
    loadingElement?.classList.toggle("hidden", stateName !== "loading");
    emptyElement?.classList.toggle("hidden", stateName !== "empty");
    errorElement?.classList.toggle("hidden", stateName !== "error");
    summaryElement?.classList.toggle("hidden", stateName !== "results");
    resultsElement?.classList.toggle("hidden", stateName !== "results");
  }

  async function loadSearchItems() {
    if (articleItems) {
      return articleItems;
    }

    const response = await fetch(searchEndpoint, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Search request failed");
    }

    const payload = await response.json();
    articleItems = Array.isArray(payload?.items) ? payload.items : [];
    return articleItems;
  }

  function updateSearchUrl(query) {
    const nextUrl = new URL(window.location.href);

    if (query) {
      nextUrl.searchParams.set("q", query);
    } else {
      nextUrl.searchParams.delete("q");
    }

    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  async function renderSearchResults(rawQuery = "") {
    const requestId = currentRequestId + 1;
    currentRequestId = requestId;

    const trimmedQuery = rawQuery.trim();
    const tokens = tokenizeSearchValue(trimmedQuery);

    updateSearchUrl(trimmedQuery);

    if (!tokens.length) {
      resultsElement.innerHTML = "";
      setState("idle");
      return;
    }

    setState("loading");

    try {
      const items = await loadSearchItems();

      if (requestId !== currentRequestId) {
        return;
      }

      const results = items
      .map((article) => ({
        article,
        score: scoreSearchMatch(buildSearchDocument(article), tokens)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return new Date(b.article.createdAt).getTime() - new Date(a.article.createdAt).getTime();
      })
      .map((entry) => entry.article);

      if (requestId !== currentRequestId) {
        return;
      }

      if (!results.length) {
        resultsElement.innerHTML = "";
        if (queryElement) {
          queryElement.textContent = `“${trimmedQuery}”`;
        }
        if (countElement) {
          countElement.textContent = "0";
        }
        setState("empty");
        return;
      }

      resultsElement.innerHTML = results.map((article) => createSearchResultMarkup(article, tokens)).join("");

      if (countElement) {
        countElement.textContent = String(results.length);
      }

      if (queryElement) {
        queryElement.textContent = `“${trimmedQuery}”`;
      }

      setState("results");
    } catch {
      if (requestId !== currentRequestId) {
        return;
      }

      setState("error");
    }
  }

  const debouncedRenderSearchResults = debounce((nextQuery) => {
    renderSearchResults(nextQuery);
  }, 220);

  formElement?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSearchResults(inputElement?.value ?? "");
  });

  inputElement?.addEventListener("input", (event) => {
    debouncedRenderSearchResults(event.currentTarget.value);
  });

  window.addEventListener("popstate", () => {
    const nextQuery = new URLSearchParams(window.location.search).get("q") ?? "";

    if (inputElement) {
      inputElement.value = nextQuery;
    }

    renderSearchResults(nextQuery);
  });

  await renderSearchResults(initialQuery);
}

function setShareButtonFeedback(buttonElement, labelText, iconClass) {
  const iconElement = buttonElement.querySelector(".js-share-btn-icon");
  const labelElement = buttonElement.querySelector(".js-share-btn-label");

  if (iconElement) {
    iconElement.className = iconClass;
  }

  if (labelElement) {
    labelElement.textContent = labelText;
  } else {
    buttonElement.textContent = labelText;
  }
}

function restoreShareButton(buttonElement) {
  const originalLabel = buttonElement.dataset.originalLabel || "Compartir";
  const originalIcon = buttonElement.dataset.originalIcon || "fa-solid fa-share-nodes";
  setShareButtonFeedback(buttonElement, originalLabel, originalIcon);
}

function trackMatomoEvent(category, action, name, value) {
  if (!Array.isArray(window._paq)) {
    return;
  }

  const payload = ["trackEvent", category, action];

  if (typeof name !== "undefined") {
    payload.push(name);
  }

  if (typeof value !== "undefined") {
    payload.push(value);
  }

  window._paq.push(payload);
}

function trackSubscriptionIntent(source) {
  trackMatomoEvent("subscription", "open_boletin", source || "unknown");
}

function withShareCampaign(rawUrl) {
  const url = new URL(rawUrl, window.location.origin);
  url.searchParams.set("mtm_campaign", "share");
  return url.toString();
}

function getSharePayload(buttonElement) {
  const currentUrl = window.location.href;
  const currentTitle = document.title;
  const canonicalPath = window.location.pathname;
  const explicitType = buttonElement.dataset.shareContentType;
  const pageType = explicitType || (canonicalPath === "/" ? "homepage" : "article");
  const contentId = buttonElement.dataset.shareContentId || (pageType === "homepage" ? "homepage" : canonicalPath);
  const homepageTitle = "La Otra Pucela - Informacion vecinal, util e independiente sobre Valladolid";
  const rawContentUrl = buttonElement.dataset.url || currentUrl;
  const contentTitle = buttonElement.dataset.title || (pageType === "homepage" ? homepageTitle : currentTitle);
  const contentUrl = withShareCampaign(rawContentUrl);
  const shareSource = buttonElement.dataset.shareSource || "unknown";
  const eventName = pageType === "homepage"
    ? "Home"
    : pageType === "article"
      ? String(contentId)
      : pageType === "newsletter"
        ? "Boletin"
      : contentUrl;

  return {
    contentId,
    contentTitle,
    contentUrl,
    eventName,
    pageType,
    shareSource
  };
}

function trackShare(buttonElement, method) {
  const {
    eventName
  } = getSharePayload(buttonElement);

  trackMatomoEvent("share", method, eventName);
}

async function copyCurrentUrl(sharePayload) {
  const shareText = `${sharePayload.contentTitle}\n\n${sharePayload.contentUrl}`;
  await navigator.clipboard.writeText(shareText);
}

async function handleShareClick(event) {
  const buttonElement = event.currentTarget;

  if (!buttonElement.dataset.originalLabel) {
    const labelElement = buttonElement.querySelector(".js-share-btn-label");
    const iconElement = buttonElement.querySelector(".js-share-btn-icon");

    buttonElement.dataset.originalLabel = labelElement?.textContent?.trim() || "Compartir";
    buttonElement.dataset.originalIcon = iconElement?.className || "fa-solid fa-share-nodes";
  }

  try {
    if (navigator.share) {
      const sharePayload = getSharePayload(buttonElement);

      try {
        await navigator.share({
          title: sharePayload.contentTitle,
          text: sharePayload.contentTitle,
          url: sharePayload.contentUrl
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          restoreShareButton(buttonElement);
          return;
        }

        throw error;
      }

      trackShare(buttonElement, "web_share");
      return;
    }

    throw new Error("Web Share API not available");
  } catch {
    try {
      await copyCurrentUrl(getSharePayload(buttonElement));
      trackShare(buttonElement, "clipboard");
      setShareButtonFeedback(buttonElement, "¡Enlace copiado!", "fa-solid fa-check js-share-btn-icon text-base");

      window.setTimeout(() => {
        restoreShareButton(buttonElement);
      }, 2500);
    } catch {
      restoreShareButton(buttonElement);
    }
  }
}

function setupShareButtons() {
  const shareButtons = document.querySelectorAll(".js-share-btn");

  if (!shareButtons.length) {
    return;
  }

  shareButtons.forEach((buttonElement) => {
    buttonElement.addEventListener("click", handleShareClick);
  });
}

function setupSubscriptionLinks() {
  const subscriptionLinks = document.querySelectorAll("[data-subscription-link]");

  if (!subscriptionLinks.length) {
    return;
  }

  subscriptionLinks.forEach((linkElement) => {
    const source = linkElement.dataset.subscriptionSource || "unknown";

    linkElement.addEventListener("click", () => {
      if (linkElement.dataset.subscriptionMarkSubscribed === "true") {
        const currentState = normalizeConditionalSubscriptionState(
          safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey)
        );

        safelyWriteLocalStorage(conditionalSubscriptionStateStorageKey, JSON.stringify({
          ...currentState,
          subscribed: true
        }));
      }

      trackSubscriptionIntent(source);
    });
  });
}

const newsletterVisitedStorageKey = "newsletterPageVisited";
const conditionalSubscriptionStateStorageKey = "conditionalSubscriptionState";
const conditionalSubscriptionVisitThreshold = 3;
const conditionalSubscriptionCooldownDays = 30;
const conditionalSubscriptionScrollThreshold = 0.3;

function safelyReadLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safelyWriteLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in privacy-restricted contexts.
  }
}

function safelyReadJsonFromLocalStorage(key) {
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

function getTodayStorageDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeConditionalSubscriptionState(state) {
  if (!state || typeof state !== "object") {
    return {
      visitedDaysCount: 0
    };
  }

  return {
    lastVisitDate: typeof state.lastVisitDate === "string" ? state.lastVisitDate : undefined,
    visitedDaysCount: Number.isFinite(Number(state.visitedDaysCount))
      ? Math.max(0, Number(state.visitedDaysCount))
      : 0,
    dismissedUntil: typeof state.dismissedUntil === "string" ? state.dismissedUntil : undefined,
    subscribed: state.subscribed === true
  };
}

function updateConditionalSubscriptionVisitState() {
  const today = getTodayStorageDate();
  const currentState = normalizeConditionalSubscriptionState(
    safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey)
  );

  if (currentState.lastVisitDate === today) {
    return currentState;
  }

  const nextState = {
    ...currentState,
    lastVisitDate: today,
    visitedDaysCount: currentState.visitedDaysCount + 1
  };

  safelyWriteLocalStorage(conditionalSubscriptionStateStorageKey, JSON.stringify(nextState));
  return nextState;
}

function setupConditionalSubscriptionVisitTracking() {
  updateConditionalSubscriptionVisitState();
}

function setupConditionalSubscriptionModule() {
  const moduleElement = document.querySelector("[data-conditional-subscription]");
  const articleBody = document.querySelector(".article-body");

  if (!moduleElement || !articleBody) {
    return;
  }

  const closeButton = moduleElement.querySelector("[data-conditional-subscription-close]");
  const currentState = normalizeConditionalSubscriptionState(
    safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey)
  );
  const today = getTodayStorageDate();

  if (currentState.subscribed) {
    return;
  }

  if (
    currentState.dismissedUntil
    && currentState.dismissedUntil >= today
  ) {
    return;
  }

  if (currentState.visitedDaysCount < conditionalSubscriptionVisitThreshold) {
    return;
  }

  let isVisible = false;
  let hasTriggered = false;

  function setVisible(visible) {
    isVisible = visible;

    if (visible) {
      moduleElement.dataset.ready = "true";
      window.setTimeout(() => {
        moduleElement.dataset.visible = "true";
        moduleElement.setAttribute("aria-hidden", "false");
      }, 24);
      return;
    }

    moduleElement.dataset.visible = "false";
    moduleElement.setAttribute("aria-hidden", "true");
  }

  function getScrollProgress() {
    const articleRect = articleBody.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const articleHeight = articleBody.offsetHeight;
    const totalScrollable = Math.max(articleHeight - viewportHeight, 1);
    const consumed = Math.min(Math.max(-articleRect.top, 0), totalScrollable);

    return consumed / totalScrollable;
  }

  const handleScroll = throttle(() => {
    if (hasTriggered || isVisible) {
      return;
    }

    if (getScrollProgress() < conditionalSubscriptionScrollThreshold) {
      return;
    }

    hasTriggered = true;
    setVisible(true);
  }, 100);

  closeButton?.addEventListener("click", () => {
    const dismissedUntil = new Date(Date.now() + (conditionalSubscriptionCooldownDays * 24 * 60 * 60 * 1000))
      .toISOString()
      .slice(0, 10);

    safelyWriteLocalStorage(conditionalSubscriptionStateStorageKey, JSON.stringify({
      ...normalizeConditionalSubscriptionState(
        safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey)
      ),
      dismissedUntil
    }));

    setVisible(false);
  });

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();
}

function setupNewsletterHeaderState() {
  const newsletterHeaderLabel = document.querySelector("[data-newsletter-header-label]");
  const newsletterHeaderLink = document.querySelector("[data-newsletter-header-link]");

  if (!newsletterHeaderLabel || !newsletterHeaderLink) {
    return;
  }

  const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
  const hasVisitedNewsletter = safelyReadLocalStorage(newsletterVisitedStorageKey) === "true";

  if (currentPath === "/boletin") {
    safelyWriteLocalStorage(newsletterVisitedStorageKey, "true");
    newsletterHeaderLabel.classList.add("hidden");
    return;
  }

  if (hasVisitedNewsletter) {
    newsletterHeaderLabel.classList.add("hidden");
  }

  newsletterHeaderLink.addEventListener("click", () => {
    safelyWriteLocalStorage(newsletterVisitedStorageKey, "true");
  });
}

function setupRssDialog() {
  const triggerElement = document.querySelector("[data-rss-trigger]");
  const dialogElement = document.querySelector("[data-rss-dialog]");

  if (!triggerElement || !dialogElement) {
    return;
  }

  const closeButton = dialogElement.querySelector("[data-rss-close]");
  const copyButton = dialogElement.querySelector("[data-rss-copy]");
  const copyLabel = dialogElement.querySelector("[data-rss-copy-label]");
  const inputElement = dialogElement.querySelector("[data-rss-feed-input]");
  const readerLinks = dialogElement.querySelectorAll("[data-rss-reader]");
  const feedUrl = triggerElement.dataset.feedUrl || triggerElement.href;

  if (!feedUrl || !inputElement) {
    return;
  }

  inputElement.value = feedUrl;

  const readerUrls = {
    feedly: `https://feedly.com/i/subscription/feed/${encodeURIComponent(feedUrl)}`,
    inoreader: `https://www.inoreader.com/?add_feed=${encodeURIComponent(feedUrl)}`,
    newsblur: `https://www.newsblur.com/?url=${encodeURIComponent(feedUrl)}`,
    theoldreader: `https://theoldreader.com/feeds/subscribe?url=${encodeURIComponent(feedUrl)}`
  };

  readerLinks.forEach((linkElement) => {
    const readerName = linkElement.dataset.rssReader;
    const readerUrl = readerUrls[readerName];

    if (!readerUrl) {
      return;
    }

    linkElement.href = readerUrl;
  });

  function openDialog() {
    if (typeof dialogElement.showModal !== "function") {
      window.location.href = feedUrl;
      return;
    }

    dialogElement.showModal();
    document.body.classList.add("overflow-hidden");
    window.setTimeout(() => {
      inputElement.focus();
      inputElement.select();
    }, 30);
  }

  function closeDialog() {
    if (dialogElement.open) {
      dialogElement.close();
    }

    document.body.classList.remove("overflow-hidden");
    triggerElement.focus();
  }

  async function copyFeedUrl() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      copyLabel.textContent = "Copiada";
      window.setTimeout(() => {
        copyLabel.textContent = "Copiar";
      }, 2200);
    } catch {
      inputElement.focus();
      inputElement.select();
      copyLabel.textContent = "Seleccionada";
      window.setTimeout(() => {
        copyLabel.textContent = "Copiar";
      }, 2200);
    }
  }

  triggerElement.addEventListener("click", (event) => {
    event.preventDefault();
    openDialog();
  });

  closeButton?.addEventListener("click", closeDialog);
  copyButton?.addEventListener("click", copyFeedUrl);

  dialogElement.addEventListener("click", (event) => {
    const dialogBounds = dialogElement.getBoundingClientRect();
    const isBackdropClick =
      event.clientX < dialogBounds.left
      || event.clientX > dialogBounds.right
      || event.clientY < dialogBounds.top
      || event.clientY > dialogBounds.bottom;

    if (isBackdropClick) {
      closeDialog();
    }
  });

  dialogElement.addEventListener("close", () => {
    document.body.classList.remove("overflow-hidden");
    triggerElement.focus();
  });
}

function setupRelatedCarousel() {
  const viewportElement = document.querySelector(".js-related-viewport");
  const trackElement = document.querySelector(".js-related-track");
  const previousButton = document.querySelector(".js-related-prev");
  const nextButton = document.querySelector(".js-related-next");

  if (!viewportElement || !trackElement || !previousButton || !nextButton) {
    return;
  }

  function scrollRelated(direction) {
    const firstCard = trackElement.querySelector("article");
    const scrollStep = firstCard
      ? firstCard.getBoundingClientRect().width + 16
      : viewportElement.clientWidth * 0.8;

    viewportElement.scrollBy({
      left: direction * scrollStep,
      behavior: "smooth"
    });
  }

  previousButton.addEventListener("click", () => {
    scrollRelated(-1);
  });

  nextButton.addEventListener("click", () => {
    scrollRelated(1);
  });
}

function setupScrollTopButton() {
  const scrollTopButton = document.querySelector(".js-scroll-top");
  const scrollShareButton = document.querySelector(".js-scroll-share-btn");

  if (!scrollTopButton) {
    return;
  }

  function syncScrollTopButton() {
    const shouldShow = window.scrollY > 520;

    scrollTopButton.classList.toggle("pointer-events-none", !shouldShow);
    scrollTopButton.classList.toggle("opacity-0", !shouldShow);
    scrollTopButton.classList.toggle("translate-y-3", !shouldShow);
    scrollTopButton.classList.toggle("opacity-100", shouldShow);
    scrollTopButton.classList.toggle("translate-y-0", shouldShow);

    if (scrollShareButton) {
      scrollShareButton.classList.toggle("pointer-events-none", !shouldShow);
      scrollShareButton.classList.toggle("opacity-0", !shouldShow);
      scrollShareButton.classList.toggle("translate-y-3", !shouldShow);
      scrollShareButton.classList.toggle("opacity-100", shouldShow);
      scrollShareButton.classList.toggle("translate-y-0", shouldShow);
    }
  }

  scrollTopButton.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  syncScrollTopButton();
  window.addEventListener("scroll", syncScrollTopButton, { passive: true });
}

function normalizeCommentCount(topicPayload) {
  const posts = Array.isArray(topicPayload?.post_stream?.posts)
    ? topicPayload.post_stream.posts
    : [];

  if (!posts.length) {
    const replyCount = Number(topicPayload?.reply_count ?? 0);
    return Math.max(replyCount, 0);
  }

  const visibleReplies = posts.filter((post) => {
    if (!post || Number(post.post_number) <= 1) {
      return false;
    }

    if (post.hidden || post.deleted_at) {
      return false;
    }

    // Discourse marks open/close/status changes as small_action posts.
    if (post.post_type !== 1) {
      return false;
    }

    return true;
  });

  return visibleReplies.length;
}

function normalizeLatestTopicPostNumber(topicPayload) {
  const highestPostNumber = Number(topicPayload?.highest_post_number ?? 0);

  if (highestPostNumber > 1) {
    return highestPostNumber;
  }

  const streamPostNumbers = Array.isArray(topicPayload?.post_stream?.stream)
    ? topicPayload.post_stream.stream
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 1)
    : [];

  if (streamPostNumbers.length) {
    return Math.max(...streamPostNumbers);
  }

  const posts = Array.isArray(topicPayload?.post_stream?.posts)
    ? topicPayload.post_stream.posts
    : [];
  const visiblePostNumbers = posts
    .map((post) => Number(post?.post_number ?? 0))
    .filter((value) => Number.isFinite(value) && value > 1);

  if (visiblePostNumbers.length) {
    return Math.max(...visiblePostNumbers);
  }

  return 2;
}

function buildTopicPostUrl(topicUrl, postNumber = 2) {
  if (!topicUrl) {
    return "";
  }

  const normalizedTopicUrl = String(topicUrl).replace(/\/+$/, "");
  const normalizedPostNumber = Number(postNumber);

  if (!Number.isFinite(normalizedPostNumber) || normalizedPostNumber < 2) {
    return `${normalizedTopicUrl}/2`;
  }

  return `${normalizedTopicUrl}/${normalizedPostNumber}`;
}

function updateCommentCount(commentCount) {
  const commentCountElements = document.querySelectorAll(".js-comment-count");

  commentCountElements.forEach((element) => {
    if (commentCount > 0) {
      element.textContent = String(commentCount);
      element.classList.remove("hidden");
      return;
    }

    element.textContent = "";
    element.classList.add("hidden");
  });
}

function loadDiscourseEmbed(discourseUrl, topicId) {
  if (!discourseUrl || !topicId || document.querySelector('script[data-js-discourse-embed="true"]')) {
    return;
  }

  window.DiscourseEmbed = {
    discourseUrl,
    topicId: Number(topicId)
  };

  const embedScript = document.createElement("script");
  embedScript.src = `${discourseUrl}javascripts/embed.js`;
  embedScript.async = true;
  embedScript.dataset.jsDiscourseEmbed = "true";
  document.body.appendChild(embedScript);
}

function refreshDiscourseEmbed() {
  const embedFrame =
    document.getElementById("discourse-embed-frame") ??
    document.querySelector('iframe[id^="discourse-embed"]');

  if (!embedFrame || !embedFrame.src) {
    return;
  }

  embedFrame.src = embedFrame.src;
}

async function fetchTopicMetadata(topicJsonUrl, fallbackCount, fallbackLatestPostNumber = 2) {
  if (!topicJsonUrl) {
    return {
      commentCount: fallbackCount,
      latestPostNumber: fallbackLatestPostNumber
    };
  }

  try {
    const response = await fetch(topicJsonUrl, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        commentCount: fallbackCount,
        latestPostNumber: fallbackLatestPostNumber
      };
    }

    const topicPayload = await response.json();
    return {
      commentCount: normalizeCommentCount(topicPayload),
      latestPostNumber: normalizeLatestTopicPostNumber(topicPayload)
    };
  } catch {
    return {
      commentCount: fallbackCount,
      latestPostNumber: fallbackLatestPostNumber
    };
  }
}

async function setupCommentsSection() {
  const commentsRoot = document.querySelector(".js-comments-root");

  if (!commentsRoot) {
    return;
  }

  const addCommentLink = commentsRoot.querySelector(".js-add-comment-link");
  const emptyState = commentsRoot.querySelector(".js-comments-empty-state");
  const embedContainer = commentsRoot.querySelector(".js-comments-embed");
  const discourseUrl = commentsRoot.dataset.discourseUrl;
  const topicId = commentsRoot.dataset.topicId;
  const topicUrl = commentsRoot.dataset.topicUrl;
  const topicJsonUrl = commentsRoot.dataset.topicJsonUrl;
  const initialReplies = Number(commentsRoot.dataset.initialReplies ?? 0);

  let commentCount = initialReplies;
  let latestPostNumber = 2;
  let hasLoadedEmbed = false;

  function renderCommentsSection(nextCommentCount, previousCommentCount = commentCount) {
    updateCommentCount(nextCommentCount);

    if (nextCommentCount > 0) {
      if (addCommentLink) {
        addCommentLink.href = buildTopicPostUrl(topicUrl, latestPostNumber);
      }

      addCommentLink?.classList.remove("hidden");
      emptyState?.classList.add("hidden");
      embedContainer?.classList.remove("hidden");

      if (!hasLoadedEmbed) {
        loadDiscourseEmbed(discourseUrl, topicId);
        hasLoadedEmbed = true;
      } else if (nextCommentCount !== previousCommentCount) {
        refreshDiscourseEmbed();
      }

      return;
    }

    addCommentLink?.classList.add("hidden");
    embedContainer?.classList.add("hidden");
    emptyState?.classList.remove("hidden");
  }

  async function syncCommentsSection() {
    const topicMetadata = await fetchTopicMetadata(topicJsonUrl, commentCount, latestPostNumber);
    const previousCommentCount = commentCount;

    commentCount = topicMetadata.commentCount;
    latestPostNumber = topicMetadata.latestPostNumber;
    renderCommentsSection(commentCount, previousCommentCount);
  }

  await syncCommentsSection();

  const refreshIntervalMs = 30000;

  window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    syncCommentsSection();
  }, refreshIntervalMs);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      syncCommentsSection();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupPwaRegistration();
  setupInstallPrompt();
  setupHeaderAutoHide();
  setupHeaderMenu();
  setupSearchPage();
  setupShareButtons();
  setupSubscriptionLinks();
  setupConditionalSubscriptionVisitTracking();
  setupConditionalSubscriptionModule();
  setupNewsletterHeaderState();
  setupRssDialog();
  setupRelatedCarousel();
  setupScrollTopButton();
  setupCommentsSection();
});
