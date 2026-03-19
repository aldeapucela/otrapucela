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

    if (searchDocument.title.includes(token)) {
      tokenScore = Math.max(tokenScore, 12);
    }

    if (searchDocument.tags.includes(token)) {
      tokenScore = Math.max(tokenScore, 8);
    }

    if (searchDocument.author.includes(token)) {
      tokenScore = Math.max(tokenScore, 6);
    }

    if (searchDocument.description.includes(token) || searchDocument.excerpt.includes(token)) {
      tokenScore = Math.max(tokenScore, 4);
    }

    if (searchDocument.content.includes(token)) {
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

    let searchStartIndex = 0;

    while (searchStartIndex < normalizedValue.length) {
      const matchIndex = normalizedValue.indexOf(token, searchStartIndex);

      if (matchIndex === -1) {
        break;
      }

      const start = indexMap[matchIndex];
      const end = indexMap[Math.min(matchIndex + token.length - 1, indexMap.length - 1)] + 1;

      if (typeof start === "number" && typeof end === "number" && end > start) {
        ranges.push({ start, end });
      }

      searchStartIndex = matchIndex + token.length;
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
      if (normalizedSegment.includes(token)) {
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
      <a href="${publicPath}" class="block overflow-hidden rounded-[1rem] bg-gray-100 shadow-sm">
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
  const inputElement = document.querySelector(".js-search-input");
  const loadingElement = searchRoot.querySelector(".js-search-loading");
  const summaryElement = searchRoot.querySelector(".js-search-summary");
  const countElement = searchRoot.querySelector(".js-search-count");
  const queryElement = searchRoot.querySelector(".js-search-query");
  const idleElement = searchRoot.querySelector(".js-search-idle");
  const emptyElement = searchRoot.querySelector(".js-search-empty");
  const errorElement = searchRoot.querySelector(".js-search-error");
  const resultsElement = searchRoot.querySelector(".js-search-results");
  const currentQuery = new URLSearchParams(window.location.search).get("q") ?? "";

  if (inputElement) {
    inputElement.value = currentQuery;
  }

  function setState(stateName) {
    idleElement?.classList.toggle("hidden", stateName !== "idle");
    loadingElement?.classList.toggle("hidden", stateName !== "loading");
    emptyElement?.classList.toggle("hidden", stateName !== "empty");
    errorElement?.classList.toggle("hidden", stateName !== "error");
    summaryElement?.classList.toggle("hidden", stateName !== "results");
    resultsElement?.classList.toggle("hidden", stateName !== "results");
  }

  const tokens = tokenizeSearchValue(currentQuery);

  if (!tokens.length) {
    setState("idle");
    return;
  }

  setState("loading");

  try {
    const response = await fetch(searchEndpoint, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Search request failed");
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
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

    if (!results.length) {
      setState("empty");
      return;
    }

    resultsElement.innerHTML = results.map((article) => createSearchResultMarkup(article, tokens)).join("");

    if (countElement) {
      countElement.textContent = String(results.length);
    }

    if (queryElement) {
      queryElement.textContent = `“${currentQuery.trim()}”`;
    }

    setState("results");
  } catch {
    setState("error");
  }
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
          text: `${sharePayload.contentTitle}\n\n${sharePayload.contentUrl}`,
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

async function fetchCommentCount(topicJsonUrl, fallbackCount) {
  if (!topicJsonUrl) {
    return fallbackCount;
  }

  try {
    const response = await fetch(topicJsonUrl, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return fallbackCount;
    }

    const topicPayload = await response.json();
    return normalizeCommentCount(topicPayload);
  } catch {
    return fallbackCount;
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
  const topicJsonUrl = commentsRoot.dataset.topicJsonUrl;
  const initialReplies = Number(commentsRoot.dataset.initialReplies ?? 0);

  let commentCount = initialReplies;
  let hasLoadedEmbed = false;

  function renderCommentsSection(nextCommentCount, previousCommentCount = commentCount) {
    updateCommentCount(nextCommentCount);

    if (nextCommentCount > 0) {
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
    const nextCommentCount = await fetchCommentCount(topicJsonUrl, commentCount);
    const previousCommentCount = commentCount;

    commentCount = nextCommentCount;
    renderCommentsSection(nextCommentCount, previousCommentCount);
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
  setupHeaderAutoHide();
  setupHeaderMenu();
  setupSearchPage();
  setupShareButtons();
  setupRssDialog();
  setupRelatedCarousel();
  setupScrollTopButton();
  setupCommentsSection();
});
