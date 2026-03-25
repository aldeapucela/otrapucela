const unreadCounterVisibilityStorageKey = "unreadCounterVisible";
const unreadCounterAutoEnabledStorageKey = "unreadCounterAutoEnabled";
const unreadCounterVisitThreshold = 4;

function getUnreadCounterVisibilityPreference() {
  const rawValue = safelyReadLocalStorage(unreadCounterVisibilityStorageKey);

  if (rawValue === "true") {
    return true;
  }

  if (rawValue === "false") {
    return false;
  }

  return null;
}

function setUnreadCounterVisibilityPreference(isVisible) {
  safelyWriteLocalStorage(unreadCounterVisibilityStorageKey, isVisible ? "true" : "false");
}

function hasAutoEnabledUnreadCounter() {
  return safelyReadLocalStorage(unreadCounterAutoEnabledStorageKey) === "true";
}

function setAutoEnabledUnreadCounter(enabled) {
  safelyWriteLocalStorage(unreadCounterAutoEnabledStorageKey, enabled ? "true" : "false");
}

function getVisitedDaysCount() {
  const rawState = safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey);
  const visitedDaysCount = Number(rawState?.visitedDaysCount);

  if (!Number.isFinite(visitedDaysCount)) {
    return 0;
  }

  return Math.max(0, visitedDaysCount);
}

function getFirstVisitDate() {
  const rawState = safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey);
  const firstVisitDate = typeof rawState?.firstVisitDate === "string"
    ? rawState.firstVisitDate
    : "";

  return firstVisitDate.trim();
}

function isArticlePublishedOnOrAfterFirstVisit(article) {
  const firstVisitDate = getFirstVisitDate();

  if (!firstVisitDate) {
    return true;
  }

  const articleDate = String(article?.createdAt || "").slice(0, 10);

  if (!articleDate) {
    return false;
  }

  return articleDate >= firstVisitDate;
}

function shouldAutoEnableUnreadCounter(unreadCount) {
  if (unreadCount <= 0) {
    return false;
  }

  if (getUnreadCounterVisibilityPreference() !== null) {
    return false;
  }

  if (hasAutoEnabledUnreadCounter()) {
    return false;
  }

  return getVisitedDaysCount() > unreadCounterVisitThreshold;
}

function resolveUnreadCounterVisibility(unreadCount) {
  const explicitPreference = getUnreadCounterVisibilityPreference();

  if (explicitPreference !== null) {
    return explicitPreference;
  }

  if (shouldAutoEnableUnreadCounter(unreadCount)) {
    setUnreadCounterVisibilityPreference(true);
    setAutoEnabledUnreadCounter(true);
    return true;
  }

  return false;
}

function getUnreadArticles(items = [], selectedTheme = "") {
  const visitedArticleIds = new Set(getVisitedArticleIds());

  return items
    .filter((article) => article?.id)
    .filter((article) => isArticlePublishedOnOrAfterFirstVisit(article))
    .filter((article) => !visitedArticleIds.has(String(article.id)))
    .filter((article) =>
      !selectedTheme || (article.tags ?? []).some((tag) => tag?.slug === selectedTheme)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function dispatchUnreadArticlesUpdated() {
  document.dispatchEvent(new CustomEvent("unread-articles-updated"));
}

function syncUnreadBadges(unreadCount) {
  const shouldShow = resolveUnreadCounterVisibility(unreadCount) && unreadCount > 0;
  const badges = document.querySelectorAll("[data-unread-count-badge]");
  const menuDots = document.querySelectorAll("[data-unread-menu-dot]");

  badges.forEach((badge) => {
    badge.textContent = String(unreadCount);
    badge.classList.toggle("hidden", !shouldShow);
  });

  menuDots.forEach((dot) => {
    dot.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    dot.classList.toggle("hidden", !shouldShow);
    dot.classList.toggle("inline-flex", shouldShow);
  });
}

function openDialog(dialogElement) {
  if (!dialogElement || typeof dialogElement.showModal !== "function") {
    return;
  }

  dialogElement.showModal();
  document.body.classList.add("overflow-hidden");
}

function closeDialog(dialogElement) {
  if (!dialogElement?.open) {
    return;
  }

  dialogElement.close();
  document.body.classList.remove("overflow-hidden");
}

function createUnreadHomepageItemMarkup(article, compact = false) {
  const title = escapeHtml(article.title ?? "");
  const publicPath = escapeHtml(article.publicPath ?? "#");
  const metaParts = [];

  if (article.createdAt) {
    metaParts.push(formatReadingListDate(article.createdAt));
  }

  if (article.author?.name) {
    metaParts.push(escapeHtml(article.author.name));
  }

  const meta = metaParts.join(" · ");

  if (compact) {
    return `
      <article class="border-b border-[#E8E0D2] dark:border-gray-700 py-3 last:border-b-0 last:pb-0">
        <h3 class="font-serif text-[1.15rem] font-semibold leading-[1.1] tracking-tight text-[#243746] dark:text-gray-100">
          <a href="${publicPath}" class="transition-colors duration-200 hover:text-[#111827] dark:hover:text-white">${title}</a>
        </h3>
        ${meta ? `<p class="mt-2 text-[0.78rem] leading-[1.5] text-[#6B7280] dark:text-gray-400 dark:text-gray-500">${meta}</p>` : ""}
      </article>
    `;
  }

  return `
    <article class="border-l border-[#E8E0D2] dark:border-gray-700 pl-5 first:border-l-0 first:pl-0">
      <h3 class="font-serif text-[1.25rem] font-semibold leading-[1.1] tracking-tight text-[#243746] dark:text-gray-100">
        <a href="${publicPath}" class="transition-colors duration-200 hover:text-[#111827] dark:hover:text-white">${title}</a>
      </h3>
      ${meta ? `<p class="mt-2 text-[0.8rem] leading-[1.5] text-[#6B7280] dark:text-gray-400 dark:text-gray-500">${meta}</p>` : ""}
    </article>
  `;
}

async function syncHomepageCatchup() {
  const sections = document.querySelectorAll("[data-home-catchup]");

  if (!sections.length) {
    return;
  }

  try {
    const articles = await loadArticlesIndex();
    const unreadRecentArticles = getUnreadArticles(articles).slice(0, 2);

    sections.forEach((section) => {
      const itemsElement = section.querySelector("[data-home-catchup-items]");

      if (!itemsElement) {
        return;
      }

      if (!unreadRecentArticles.length) {
        itemsElement.innerHTML = "";
        section.classList.add("hidden");
        return;
      }

      const isCompact = !window.matchMedia("(min-width: 1024px)").matches;
      itemsElement.innerHTML = unreadRecentArticles
        .map((article) => createUnreadHomepageItemMarkup(article, isCompact))
        .join("");

      section.classList.remove("hidden");
    });
  } catch {
    sections.forEach((section) => section.classList.add("hidden"));
  }
}

function createUnreadArticleItemMarkup(article) {
  const title = escapeHtml(article.title || "Artículo");
  const url = escapeHtml(article.publicPath || "#");
  const author = escapeHtml(article.author?.name || "");
  const theme = escapeHtml(article.tags?.[0]?.name || article.tags?.[0]?.slug || "");
  const image = article.image
    ? `<img src="${escapeHtml(article.image)}" alt="${title}" class="h-14 w-[4.5rem] shrink-0 rounded-lg object-cover sm:h-[4.6rem] sm:w-[5.75rem]">`
    : `<div class="flex h-14 w-[4.5rem] shrink-0 items-center justify-center rounded-lg bg-[#F4F1E9] dark:bg-[#1a2529] text-[#8A7F6B] sm:h-[4.6rem] sm:w-[5.75rem]"><i class="fa-regular fa-newspaper" aria-hidden="true"></i></div>`;
  const meta = [formatReadingListDate(article.createdAt), author].filter(Boolean).join(" · ");

  return `
    <article class="border-b border-[#E7E1D6] dark:border-gray-700 py-3 last:border-b-0 sm:py-4">
      <div class="flex items-start gap-3 sm:gap-4">
        <a href="${url}" class="shrink-0">${image}</a>
        <div class="min-w-0 flex-1">
          ${theme ? `<p class="text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#8A7F6B]">${theme}</p>` : ""}
          <a href="${url}" class="mt-0.5 block font-serif text-[0.92rem] font-semibold leading-[1.22] tracking-tight text-gray-900 dark:text-white transition-colors duration-200 hover:text-gray-700 dark:text-gray-300 sm:mt-1 sm:text-[1rem]">
            ${title}
          </a>
          ${meta ? `<p class="mt-0.5 text-[0.75rem] leading-[1.45] text-gray-500 dark:text-gray-400 dark:text-gray-500 sm:mt-1 sm:text-[0.8rem]">${meta}</p>` : ""}
        </div>
        <button
          type="button"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full border border-[#D9D1C4] dark:border-gray-700 bg-white dark:bg-[#1a2529] text-[#3F3424] dark:text-gray-300 transition-colors duration-200 hover:bg-[#F3EBDD] dark:hover:bg-gray-700 sm:h-11 sm:w-11"
          data-unread-mark-read="${escapeHtml(article.id)}"
          aria-label="Marcar como leído"
          title="Marcar como leído"
        >
          <i class="fa-solid fa-check text-[0.95rem]" aria-hidden="true"></i>
        </button>
      </div>
    </article>
  `;
}

async function syncUnreadIndicators() {
  try {
    const articles = await loadArticlesIndex();
    syncUnreadBadges(getUnreadArticles(articles).length);
  } catch {
    syncUnreadBadges(0);
  }
}

async function setupUnreadPage() {
  const pageElement = document.querySelector("[data-unread-page]");

  if (!pageElement) {
    return;
  }

  const loadingElement = pageElement.querySelector("[data-unread-loading]");
  const emptyElement = pageElement.querySelector("[data-unread-empty]");
  const emptyCopyElement = pageElement.querySelector("[data-unread-empty-copy]");
  const containerElement = pageElement.querySelector("[data-unread-container]");
  const filterEmptyElement = pageElement.querySelector("[data-unread-filter-empty]");
  const itemsElement = pageElement.querySelector("[data-unread-items]");
  const countElements = Array.from(pageElement.querySelectorAll("[data-unread-count]"));
  const introElement = document.querySelector("[data-unread-intro]");
  const filterElements = Array.from(pageElement.querySelectorAll("[data-unread-theme-filter]"));
  const toggleElements = Array.from(pageElement.querySelectorAll("[data-unread-counter-toggle]"));
  const markAllButton = pageElement.querySelector("[data-unread-mark-all-read]");
  const markAllMobileButton = pageElement.querySelector("[data-unread-mark-all-read-mobile]");
  const confirmDialog = document.querySelector("[data-unread-confirm-dialog]");
  const confirmCancelButton = document.querySelector("[data-unread-confirm-cancel]");
  const confirmAcceptButton = document.querySelector("[data-unread-confirm-accept]");

  if (
    !loadingElement
    || !emptyElement
    || !containerElement
    || !filterEmptyElement
    || !itemsElement
    || !countElements.length
    || !filterElements.length
    || !toggleElements.length
    || !markAllButton
    || !markAllMobileButton
    || !confirmDialog
    || !confirmCancelButton
    || !confirmAcceptButton
  ) {
    return;
  }

  const initialToggleState = resolveUnreadCounterVisibility(0);
  toggleElements.forEach((toggleElement) => {
    toggleElement.checked = initialToggleState;
  });
  const initialFilterValue = filterElements[0]?.value || "";
  filterElements.forEach((filterElement) => {
    filterElement.value = initialFilterValue;
  });

  function setState(state) {
    loadingElement.classList.toggle("hidden", state !== "loading");
    emptyElement.classList.toggle("hidden", state !== "empty");
    containerElement.classList.toggle("hidden", state !== "ready");
  }

  async function renderUnreadPage() {
    setState("loading");

    try {
      const articles = await loadArticlesIndex();
      const selectedTheme = String(filterElements[0]?.value || "").trim();
      const allUnreadArticles = getUnreadArticles(articles);
      const unreadArticles = getUnreadArticles(articles, selectedTheme);

      countElements.forEach((countElement) => {
        countElement.textContent = String(unreadArticles.length);
      });
      const shouldShowCounter = resolveUnreadCounterVisibility(allUnreadArticles.length);
      toggleElements.forEach((toggleElement) => {
        toggleElement.checked = shouldShowCounter;
      });
      introElement?.classList.toggle("hidden", unreadArticles.length === 0);
      [markAllButton, markAllMobileButton].forEach((buttonElement) => {
        buttonElement.disabled = allUnreadArticles.length === 0;
        buttonElement.classList.toggle("opacity-50", allUnreadArticles.length === 0);
      });

      if (!unreadArticles.length) {
        itemsElement.innerHTML = "";
        filterEmptyElement.classList.toggle("hidden", !selectedTheme);

        if (selectedTheme) {
          setState("ready");
          return;
        }

        emptyCopyElement.textContent = "Cuando publiquemos algo nuevo que aún no hayas leído, aparecerá aquí.";
        setState("empty");
        return;
      }

      filterEmptyElement.classList.add("hidden");
      itemsElement.innerHTML = unreadArticles.map(createUnreadArticleItemMarkup).join("");
      setState("ready");

      itemsElement.querySelectorAll("[data-unread-mark-read]").forEach((button) => {
        button.addEventListener("click", () => {
          const articleId = button.dataset.unreadMarkRead?.trim();

          if (!articleId) {
            return;
          }

          setVisitedArticleIds([articleId, ...getVisitedArticleIds()]);
          dispatchUnreadArticlesUpdated();
          renderUnreadPage();
        });
      });
    } catch {
      itemsElement.innerHTML = "";
      filterEmptyElement.classList.add("hidden");
      emptyCopyElement.textContent = "No hemos podido cargar tus artículos pendientes ahora mismo.";
      setState("empty");
    }
  }

  filterElements.forEach((filterElement) => {
    filterElement.addEventListener("change", () => {
      filterElements.forEach((element) => {
        element.value = filterElement.value;
      });
      renderUnreadPage();
    });
  });

  toggleElements.forEach((toggleElement) => {
    toggleElement.addEventListener("change", () => {
      toggleElements.forEach((element) => {
        element.checked = toggleElement.checked;
      });
      setUnreadCounterVisibilityPreference(toggleElement.checked);
      syncUnreadIndicators();
    });
  });

  async function handleMarkAllRequest(triggerButton) {
    try {
      const articles = await loadArticlesIndex();
      const unreadArticles = getUnreadArticles(articles);

      if (!unreadArticles.length) {
        return;
      }

      openDialog(confirmDialog);
      triggerButton?.blur();
    } catch {
      // Keep page stable if the action cannot be completed.
    }
  }

  markAllButton.addEventListener("click", () => {
    handleMarkAllRequest(markAllButton);
  });

  markAllMobileButton.addEventListener("click", () => {
    handleMarkAllRequest(markAllMobileButton);
  });

  confirmCancelButton.addEventListener("click", () => {
    closeDialog(confirmDialog);
  });

  confirmDialog.addEventListener("close", () => {
    document.body.classList.remove("overflow-hidden");
  });

  confirmDialog.addEventListener("click", (event) => {
    const dialogBounds = confirmDialog.getBoundingClientRect();
    const isBackdropClick =
      event.clientX < dialogBounds.left
      || event.clientX > dialogBounds.right
      || event.clientY < dialogBounds.top
      || event.clientY > dialogBounds.bottom;

    if (isBackdropClick) {
      closeDialog(confirmDialog);
    }
  });

  confirmAcceptButton.addEventListener("click", async () => {
    try {
      const articles = await loadArticlesIndex();
      const unreadArticles = getUnreadArticles(articles);

      if (!unreadArticles.length) {
        closeDialog(confirmDialog);
        return;
      }

      setVisitedArticleIds([
        ...unreadArticles.map((article) => String(article.id)),
        ...getVisitedArticleIds()
      ]);
      closeDialog(confirmDialog);
      dispatchUnreadArticlesUpdated();
      renderUnreadPage();
    } catch {
      // Keep page stable if the action cannot be completed.
    }
  });

  document.addEventListener("unread-articles-updated", renderUnreadPage);
  renderUnreadPage();
}

document.addEventListener("DOMContentLoaded", () => {
  syncUnreadIndicators();
  syncHomepageCatchup();
  setupUnreadPage();

  document.addEventListener("unread-articles-updated", () => {
    syncUnreadIndicators();
    syncHomepageCatchup();
  });
});
