function createUnreadArticleItemMarkup(article) {
  const title = escapeHtml(article.title || "Artículo");
  const url = escapeHtml(article.publicPath || "#");
  const author = escapeHtml(article.author?.name || "");
  const theme = escapeHtml(article.tags?.[0]?.name || article.tags?.[0]?.slug || "");
  const image = article.image
    ? `<img src="${escapeHtml(article.image)}" alt="${title}" class="h-14 w-[4.5rem] shrink-0 rounded-lg object-cover sm:h-[4.6rem] sm:w-[5.75rem]">`
    : `<div class="flex h-14 w-[4.5rem] shrink-0 items-center justify-center rounded-lg bg-[#F4F1E9] text-[#8A7F6B] sm:h-[4.6rem] sm:w-[5.75rem]"><i class="fa-regular fa-newspaper" aria-hidden="true"></i></div>`;
  const meta = [formatReadingListDate(article.createdAt), author].filter(Boolean).join(" · ");

  return `
    <article class="border-b border-[#E7E1D6] py-3 last:border-b-0 sm:py-4">
      <div class="flex items-start gap-3 sm:gap-4">
        <a href="${url}" class="shrink-0">${image}</a>
        <div class="min-w-0 flex-1">
          ${theme ? `<p class="text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#8A7F6B]">${theme}</p>` : ""}
          <a href="${url}" class="mt-0.5 block font-serif text-[0.92rem] font-semibold leading-[1.22] tracking-tight text-gray-900 transition-colors duration-200 hover:text-gray-700 sm:mt-1 sm:text-[1rem]">
            ${title}
          </a>
          ${meta ? `<p class="mt-0.5 text-[0.75rem] leading-[1.45] text-gray-500 sm:mt-1 sm:text-[0.8rem]">${meta}</p>` : ""}
        </div>
        <button
          type="button"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full border border-[#D9D1C4] bg-white text-[#3F3424] transition-colors duration-200 hover:bg-[#F3EBDD] sm:h-11 sm:w-11"
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
  const countElement = pageElement.querySelector("[data-unread-count]");
  const introElement = document.querySelector("[data-unread-intro]");
  const filterElement = pageElement.querySelector("[data-unread-theme-filter]");

  if (!loadingElement || !emptyElement || !containerElement || !filterEmptyElement || !itemsElement || !countElement || !filterElement) {
    return;
  }

  function setState(state) {
    loadingElement.classList.toggle("hidden", state !== "loading");
    emptyElement.classList.toggle("hidden", state !== "empty");
    containerElement.classList.toggle("hidden", state !== "ready");
  }

  async function renderUnreadPage() {
    setState("loading");

    try {
      const visitedArticleIds = new Set(getVisitedArticleIds());
      const selectedTheme = String(filterElement.value || "").trim();
      const articles = await loadArticlesIndex();
      const unreadArticles = articles
        .filter((article) => article?.id)
        .filter((article) => !visitedArticleIds.has(String(article.id)))
        .filter((article) =>
          !selectedTheme || (article.tags ?? []).some((tag) => tag?.slug === selectedTheme)
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      countElement.textContent = String(unreadArticles.length);
      introElement?.classList.toggle("hidden", unreadArticles.length === 0);

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

  filterElement.addEventListener("change", renderUnreadPage);
  renderUnreadPage();
}

document.addEventListener("DOMContentLoaded", () => {
  setupUnreadPage();
});
