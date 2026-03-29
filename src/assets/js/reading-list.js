import { readingListStorageKey } from "./app-constants.js";
import { loadArticlesIndex } from "./article-data.js";
import {
  escapeHtml,
  formatReadingListDate,
  safelyReadJsonFromLocalStorage,
  safelyWriteLocalStorage
} from "./app-utils.js";

function normalizeReadingListEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce((entries, item) => {
    const id = String(item?.id ?? "").trim();

    if (!id || entries.some((entry) => entry.id === id)) {
      return entries;
    }

    entries.push({
      id,
      title: String(item?.title ?? "").trim(),
      url: String(item?.url ?? "").trim(),
      image: String(item?.image ?? "").trim(),
      author: String(item?.author ?? "").trim(),
      date: String(item?.date ?? "").trim(),
      savedAt: typeof item?.savedAt === "string" ? item.savedAt : new Date().toISOString()
    });

    return entries;
  }, []);
}

export function getReadingListEntries() {
  return normalizeReadingListEntries(
    safelyReadJsonFromLocalStorage(readingListStorageKey)
  );
}

export function setReadingListEntries(entries) {
  safelyWriteLocalStorage(
    readingListStorageKey,
    JSON.stringify(normalizeReadingListEntries(entries))
  );
}

function isArticleInReadingList(articleId) {
  const normalizedArticleId = String(articleId ?? "").trim();
  return getReadingListEntries().some((entry) => entry.id === normalizedArticleId);
}

function addArticleToReadingList(article) {
  const entries = getReadingListEntries().filter((entry) => entry.id !== article.id);
  entries.unshift({
    ...article,
    savedAt: new Date().toISOString()
  });
  setReadingListEntries(entries);
}

function removeArticleFromReadingList(articleId) {
  setReadingListEntries(
    getReadingListEntries().filter((entry) => entry.id !== String(articleId ?? "").trim())
  );
}

function dispatchReadingListUpdated() {
  document.dispatchEvent(new CustomEvent("reading-list-updated"));
}

export function syncReadingListCountBadges() {
  const badges = document.querySelectorAll("[data-reading-list-count-badge]");
  const menuDots = document.querySelectorAll("[data-reading-list-menu-dot]");
  const count = getReadingListEntries().length;

  badges.forEach((badge) => {
    badge.textContent = String(count);
    badge.classList.toggle("hidden", count === 0);
  });

  menuDots.forEach((dot) => {
    dot.textContent = count > 99 ? "99+" : String(count);
    dot.classList.toggle("hidden", count === 0);
    dot.classList.toggle("inline-flex", count > 0);
  });
}

function syncReadingListButtons() {
  const buttons = document.querySelectorAll("[data-reading-list-toggle]");

  buttons.forEach((button) => {
    const articleId = button.dataset.articleId?.trim();
    const isSaved = isArticleInReadingList(articleId);
    const icon = button.querySelector(".js-reading-list-toggle-icon");
    const label = button.querySelector(".js-reading-list-toggle-label");

    button.setAttribute("aria-pressed", isSaved ? "true" : "false");
    button.setAttribute("aria-label", isSaved ? "Quitar de lista de lectura" : "Guardar en lista de lectura");

    if (label) {
      label.textContent = isSaved ? "Guardado" : "Leer más tarde";
    }

    if (icon) {
      icon.className = `${isSaved ? "fa-solid" : "fa-regular"} fa-bookmark js-reading-list-toggle-icon w-4 text-center text-sm`;
    }
  });
}

function setupReadingListButtons() {
  const buttons = document.querySelectorAll("[data-reading-list-toggle]");

  if (!buttons.length) {
    return;
  }

  syncReadingListButtons();
  syncReadingListCountBadges();

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const articleId = button.dataset.articleId?.trim();

      if (!articleId) {
        return;
      }

      if (isArticleInReadingList(articleId)) {
        removeArticleFromReadingList(articleId);
      } else {
        addArticleToReadingList({
          id: articleId,
          title: button.dataset.articleTitle?.trim() || "",
          url: button.dataset.articleUrl?.trim() || "",
          image: button.dataset.articleImage?.trim() || "",
          author: button.dataset.articleAuthor?.trim() || "",
          date: button.dataset.articleDate?.trim() || ""
        });
      }

      syncReadingListButtons();
      syncReadingListCountBadges();
      dispatchReadingListUpdated();
    });
  });
}

function createReadingListItemMarkup(article) {
  const title = escapeHtml(article.title || "Artículo");
  const url = escapeHtml(article.url || "#");
  const author = escapeHtml(article.author || "");
  const image = article.image
    ? `<img src="${escapeHtml(article.image)}" alt="${title}" class="h-14 w-[4.5rem] shrink-0 rounded-lg object-cover sm:h-[4.6rem] sm:w-[5.75rem]">`
    : `<div class="flex h-14 w-[4.5rem] shrink-0 items-center justify-center rounded-lg bg-[#F4F1E9] dark:bg-[#1a2529] text-[#8A7F6B] sm:h-[4.6rem] sm:w-[5.75rem]"><i class="fa-regular fa-bookmark" aria-hidden="true"></i></div>`;
  const meta = [author, formatReadingListDate(article.date)].filter(Boolean).join(" · ");

  return `
    <article class="border-b border-[#E7E1D6] dark:border-gray-700 py-3 last:border-b-0 sm:py-4">
      <div class="flex items-start gap-3 sm:gap-4">
        <a href="${url}" class="shrink-0">${image}</a>
        <div class="min-w-0 flex-1">
          <a href="${url}" class="block font-serif text-[0.92rem] font-semibold leading-[1.22] tracking-tight text-gray-900 dark:text-white transition-colors duration-200 hover:text-gray-700 dark:text-gray-300 sm:text-[1rem]">
            ${title}
          </a>
          ${meta ? `<p class="mt-0.5 text-[0.75rem] leading-[1.45] text-gray-500 dark:text-gray-400 sm:mt-1 sm:text-[0.8rem]">${meta}</p>` : ""}
        </div>
        <button
          type="button"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full border border-[#D9D1C4] dark:border-gray-700 bg-white dark:bg-[#1a2529] text-gray-500 dark:text-gray-400 transition-colors duration-200 hover:bg-[#F3EBDD] dark:hover:bg-gray-700 hover:text-gray-700 dark:text-gray-300 sm:h-11 sm:w-11"
          data-reading-list-remove="${escapeHtml(article.id)}"
          aria-label="Quitar de la lista de lectura"
          title="Quitar de la lista de lectura"
        >
          <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
        </button>
      </div>
    </article>
  `;
}

async function setupReadingListPage() {
  const loadingElement = document.querySelector("[data-reading-list-loading]");
  const emptyElement = document.querySelector("[data-reading-list-empty]");
  const containerElement = document.querySelector("[data-reading-list-container]");
  const itemsElement = document.querySelector("[data-reading-list-items]");
  const countElement = document.querySelector("[data-reading-list-count]");
  const introElement = document.querySelector("[data-reading-list-intro]");
  const randomLinkElement = document.querySelector("[data-reading-list-random-link]");

  if (!document.querySelector("[data-reading-list-page]")) {
    return;
  }

  if (!loadingElement || !emptyElement || !containerElement || !itemsElement || !countElement) {
    return;
  }

  function setState(state) {
    loadingElement.classList.toggle("hidden", state !== "loading");
    emptyElement.classList.toggle("hidden", state !== "empty");
    containerElement.classList.toggle("hidden", state !== "ready");
  }

  async function renderReadingList() {
    const savedEntries = getReadingListEntries();
    countElement.textContent = String(savedEntries.length);
    syncReadingListCountBadges();
    introElement?.classList.toggle("hidden", savedEntries.length === 0);

    if (!savedEntries.length) {
      itemsElement.innerHTML = "";
      setState("empty");
      return;
    }

    setState("loading");

    try {
      const articles = await loadArticlesIndex();
      const articlesById = new Map(articles.map((article) => [String(article.id), article]));
      const mergedEntries = savedEntries.map((entry) => {
        const article = articlesById.get(entry.id);

        if (!article) {
          return entry;
        }

        return {
          ...entry,
          title: article.title || entry.title,
          url: article.publicPath || entry.url,
          image: article.image || entry.image,
          author: article.author?.name || entry.author,
          date: article.createdAt || entry.date
        };
      });

      setReadingListEntries(mergedEntries);
      itemsElement.innerHTML = mergedEntries.map(createReadingListItemMarkup).join("");
      setState("ready");

      itemsElement.querySelectorAll("[data-reading-list-remove]").forEach((button) => {
        button.addEventListener("click", () => {
          removeArticleFromReadingList(button.dataset.readingListRemove);
          syncReadingListButtons();
          renderReadingList();
          dispatchReadingListUpdated();
        });
      });
    } catch {
      itemsElement.innerHTML = "";
      setState("empty");
    }
  }

  randomLinkElement?.addEventListener("click", async (event) => {
    event.preventDefault();

    try {
      const articles = await loadArticlesIndex();
      const now = new Date();
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const recentArticles = articles.filter((article) => {
        const publishedAt = new Date(article.createdAt);
        return !Number.isNaN(publishedAt.getTime()) && publishedAt >= oneMonthAgo && publishedAt <= now;
      });
      const candidateArticles = recentArticles.length ? recentArticles : articles;

      if (!candidateArticles.length) {
        return;
      }

      const randomArticle = candidateArticles[Math.floor(Math.random() * candidateArticles.length)];

      if (randomArticle?.publicPath) {
        window.location.href = randomArticle.publicPath;
      }
    } catch {
      window.location.href = "/";
    }
  });

  document.addEventListener("reading-list-updated", renderReadingList);
  renderReadingList();
}

export function setupReadingListFeatures() {
  setupReadingListButtons();
  syncReadingListCountBadges();
  setupReadingListPage();
}
