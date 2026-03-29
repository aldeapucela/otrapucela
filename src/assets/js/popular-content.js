import { fetchTopicMetadata } from "./comments.js";
import { loadArticlesIndex, loadMostReadArticles } from "./article-data.js";
import {
  escapeHtml,
  escapeHtmlAttribute,
  formatReadingListDate,
  normalizePathname
} from "./app-utils.js";

function createArticleRailItemMarkup(article) {
  const title = escapeHtml(article.title ?? "");
  const publicPath = escapeHtml(article.publicPath ?? "#");
  const authorName = escapeHtml(article.author?.name ?? "");
  const authorPath = escapeHtml(article.author?.publicPath ?? "#");
  const imageMarkup = article.image
    ? `
      <div class="mb-4 overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          src="${escapeHtmlAttribute(article.image)}"
          alt="${title}"
          class="aspect-[16/10] w-full object-cover"
          loading="lazy"
        >
      </div>
    `
    : "";
  const authorMarkup = authorName
    ? `
      <p class="mt-2.5 text-[0.82rem] leading-[1.5] text-gray-700 dark:text-gray-300 sm:mt-3 sm:text-sm lg:text-[0.95rem]">
        <a href="${authorPath}" class="transition-colors duration-200 hover:text-gray-900 dark:hover:text-white">
          ${authorName}
        </a>
      </p>
    `
    : "";

  return `
    <article class="w-[15rem] min-w-[15rem] border-r border-gray-200 pr-4 last:border-r-0 last:pr-0 dark:border-gray-800 sm:w-[19rem] sm:min-w-[19rem] sm:pr-5 lg:w-[14rem] lg:min-w-[14rem] lg:pr-4">
      <a href="${publicPath}" class="block">
        ${imageMarkup}
        <h3 class="font-serif text-[1.18rem] font-semibold leading-[1.1] tracking-tight text-gray-900 dark:text-white sm:text-[1.35rem] lg:text-[1.28rem]">
          ${title}
        </h3>
        ${authorMarkup}
      </a>
    </article>
  `;
}

function createMostReadMoreItemMarkup() {
  return `
    <article class="w-[15rem] min-w-[15rem] border-r border-gray-200 pr-4 last:border-r-0 last:pr-0 dark:border-gray-800 sm:w-[19rem] sm:min-w-[19rem] sm:pr-5 lg:w-[14rem] lg:min-w-[14rem] lg:pr-4">
      <a
        href="/populares/"
        class="flex min-h-full min-h-[15.5rem] flex-col rounded-[1.5rem] border border-gray-200 bg-white p-4 transition-colors duration-200 hover:bg-gray-50 dark:border-gray-800 dark:bg-[#1a2529] dark:hover:bg-[#202b31] sm:min-h-[18.5rem] sm:p-5 lg:min-h-[16.25rem]"
      >
        <div>
          <span class="inline-flex min-h-9 items-center text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
            Descubrir más
          </span>
        </div>
        <div class="flex flex-1 items-center justify-center text-gray-600 dark:text-gray-400">
          <i class="fa-solid fa-fire text-[2.5rem] sm:text-[3.25rem]" aria-hidden="true"></i>
        </div>
        <span class="mt-5 inline-flex min-h-11 items-center gap-2 text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-gray-700 dark:text-gray-300 sm:text-sm">
          <span>Ver más populares</span>
          <i class="fa-solid fa-arrow-right text-sm" aria-hidden="true"></i>
        </span>
      </a>
    </article>
  `;
}

function formatThemeLabel(value) {
  return String(value ?? "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function createPopularArticleItemMarkup(article, index) {
  const title = escapeHtml(article.title ?? "Artículo");
  const publicPath = escapeHtml(article.publicPath ?? "#");
  const authorName = escapeHtml(article.author?.name ?? "");
  const authorPath = escapeHtml(article.author?.publicPath ?? "#");
  const hasImage = Boolean(article.image);
  const imageMarkup = article.image
    ? `
      <a href="${publicPath}" class="block overflow-hidden rounded-[1.35rem] bg-[#EDE7DB] dark:bg-[#12191e]">
        <img
          src="${escapeHtmlAttribute(article.image)}"
          alt="${title}"
          class="aspect-[16/8.5] w-full object-cover sm:aspect-[16/10]"
          loading="lazy"
        >
      </a>
    `
    : `
      <a href="${publicPath}" class="flex min-h-[10.5rem] items-end rounded-[1.35rem] bg-[#ECE4D8] p-5 text-[#324654] dark:bg-[#24333a] dark:text-gray-100 sm:min-h-[12.5rem] sm:p-6">
        <h2 class="font-serif text-[1.5rem] font-semibold leading-[1.02] tracking-tight sm:text-[1.85rem]">
          ${title}
        </h2>
      </a>
    `;
  const authorMarkup = authorName
    ? `<a href="${authorPath}" class="transition-colors duration-200 hover:text-gray-900 dark:hover:text-white">${authorName}</a>`
    : "";
  const themeName = article.tags?.[0]?.name
    ? escapeHtml(formatThemeLabel(article.tags[0].name))
    : "";
  const themeMarkup = themeName
    ? `<span class="text-[0.76rem] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">${themeName}</span>`
    : "";
  const dateMarkup = article.createdAt
    ? `<time datetime="${escapeHtmlAttribute(article.createdAt)}">${escapeHtml(formatReadingListDate(article.createdAt))}</time>`
    : "";
  const metaParts = [authorMarkup, dateMarkup].filter(Boolean);
  const metaMarkup = metaParts.length
    ? `<p class="text-[0.78rem] leading-[1.5] text-gray-500 dark:text-gray-400 sm:text-[0.82rem]">${metaParts.join(" · ")}</p>`
    : "";

  return `
    <article class="rounded-[1.6rem] border border-gray-200 bg-white p-3.5 shadow-sm dark:border-gray-800 dark:bg-[#1a2529] sm:rounded-[1.75rem] sm:p-5">
      <div class="grid gap-4 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-6">
        <div class="relative">
          ${imageMarkup}
          <div class="pointer-events-none absolute left-2.5 top-2.5 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[#1F2937] px-2 text-[0.86rem] font-semibold text-white shadow-sm sm:left-3 sm:top-3 sm:h-10 sm:min-w-10 sm:px-3 sm:text-sm">
            ${index + 1}
          </div>
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            ${themeMarkup}
          </div>
          <h2 class="mt-3 font-serif text-[1.15rem] font-semibold leading-[1.06] tracking-tight text-gray-900 dark:text-white sm:mt-4 sm:text-[1.75rem] ${hasImage ? "" : "hidden"}">
            <a href="${publicPath}" class="transition-colors duration-200 hover:text-[#334155] dark:hover:text-gray-300">
              ${title}
            </a>
          </h2>
          <div class="mt-2.5 flex items-end justify-between gap-3 sm:mt-3">
            ${metaMarkup || "<span></span>"}
            <span
              class="hidden items-center gap-1 text-[0.72rem] font-medium text-gray-500 dark:text-gray-400 sm:text-[0.78rem]"
              data-popular-comment-count
              data-article-id="${escapeHtml(String(article.id ?? ""))}"
            >
              <i class="fa-regular fa-comment text-[0.78rem]" aria-hidden="true"></i>
              <span data-popular-comment-count-value></span>
            </span>
          </div>
        </div>
      </div>
    </article>
  `;
}

async function populatePopularCommentCounts(articles, containerElement) {
  if (!containerElement || !Array.isArray(articles) || !articles.length) {
    return;
  }

  await Promise.all(articles.map(async (article) => {
    const articleId = String(article?.id ?? "").trim();
    const topicJsonUrl = article?.source?.topicJsonUrl;

    if (!articleId || !topicJsonUrl) {
      return;
    }

    const countElement = containerElement.querySelector(`[data-article-id="${CSS.escape(articleId)}"]`);
    const valueElement = countElement?.querySelector("[data-popular-comment-count-value]");

    if (!countElement || !valueElement) {
      return;
    }

    try {
      const topicMetadata = await fetchTopicMetadata(topicJsonUrl, 0, 2);

      if (topicMetadata.commentCount > 0) {
        valueElement.textContent = String(topicMetadata.commentCount);
        countElement.classList.remove("hidden");
        countElement.classList.add("inline-flex");
      }
    } catch {
      // Keep the list clean if comment metadata fails.
    }
  }));
}

async function setupMostReadArticles() {
  const sectionElement = document.querySelector("[data-most-read-section]");

  if (!sectionElement) {
    return;
  }

  const itemsElement = sectionElement.querySelector("[data-most-read-items]");

  if (!itemsElement) {
    return;
  }

  const currentArticlePath = normalizePathname(sectionElement.dataset.currentArticlePath);

  try {
    const mostReadArticles = (await loadMostReadArticles())
      .filter((article) => article?.publicPath)
      .filter((article) => normalizePathname(article.publicPath) !== currentArticlePath)
      .slice(0, 3);

    if (!mostReadArticles.length) {
      return;
    }

    itemsElement.innerHTML = [
      ...mostReadArticles.map(createArticleRailItemMarkup),
      createMostReadMoreItemMarkup()
    ].join("");
    sectionElement.classList.remove("hidden");
    window.dispatchEvent(new Event("resize"));
  } catch {
    // Keep the article page stable if the remote ranking is unavailable.
  }
}

async function setupPopularPage() {
  const pageElement = document.querySelector("[data-popular-page]");

  if (!pageElement) {
    return;
  }

  const loadingElement = pageElement.querySelector("[data-popular-loading]");
  const emptyElement = pageElement.querySelector("[data-popular-empty]");
  const readyElement = pageElement.querySelector("[data-popular-ready]");
  const itemsElement = pageElement.querySelector("[data-popular-items]");

  if (!loadingElement || !emptyElement || !readyElement || !itemsElement) {
    return;
  }

  function setState(state) {
    loadingElement.classList.toggle("hidden", state !== "loading");
    emptyElement.classList.toggle("hidden", state !== "empty");
    readyElement.classList.toggle("hidden", state !== "ready");
  }

  setState("loading");

  try {
    const popularArticles = (await loadMostReadArticles()).slice(0, 10);

    if (!popularArticles.length) {
      setState("empty");
      return;
    }

    itemsElement.innerHTML = popularArticles
      .map((article, index) => createPopularArticleItemMarkup(article, index))
      .join("");
    populatePopularCommentCounts(popularArticles, itemsElement);
    setState("ready");
  } catch {
    itemsElement.innerHTML = "";
    setState("empty");
  }
}

export function setupPopularContent() {
  setupMostReadArticles();
  setupPopularPage();
}
