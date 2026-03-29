import { debounce, escapeHtml } from "./app-utils.js";

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
  return normalizedValue ? normalizedValue.split(" ").filter(Boolean) : [];
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
  return source
    ? source.split(/(?<=[.!?])\s+/).map((segment) => segment.trim()).filter(Boolean)
    : [];
}

function scoreSearchMatch(searchDocument, tokens) {
  let score = 0;

  for (const token of tokens) {
    let tokenScore = 0;

    if (hasWholeWordMatch(searchDocument.title, token)) tokenScore = Math.max(tokenScore, 12);
    if (hasWholeWordMatch(searchDocument.tags, token)) tokenScore = Math.max(tokenScore, 8);
    if (hasWholeWordMatch(searchDocument.author, token)) tokenScore = Math.max(tokenScore, 6);
    if (hasWholeWordMatch(searchDocument.description, token) || hasWholeWordMatch(searchDocument.excerpt, token)) {
      tokenScore = Math.max(tokenScore, 4);
    }
    if (hasWholeWordMatch(searchDocument.content, token)) tokenScore = Math.max(tokenScore, 2);

    if (tokenScore === 0) {
      return 0;
    }

    score += tokenScore;
  }

  return score;
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
    } else {
      previousRange.end = Math.max(previousRange.end, range.end);
    }
  }

  let highlighted = "";
  let cursor = 0;

  for (const range of mergedRanges) {
    highlighted += escapeHtml(source.slice(cursor, range.start));
    highlighted += `<mark class="rounded-sm bg-[#E8D7A7] px-1 py-[0.05rem] text-gray-900 dark:text-white">${escapeHtml(source.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }

  highlighted += escapeHtml(source.slice(cursor));
  return highlighted;
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
      <a href="${publicPath}" class="block overflow-hidden bg-gray-100 dark:bg-[#1a2529] shadow-sm">
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
    ? `<p class="mt-4 text-base leading-[1.6] text-gray-600 dark:text-gray-400 dark:text-gray-500">${snippet}</p>`
    : "";

  return `
    <article class="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0 last:pb-0">
      <div class="${layoutClass}">
        ${imageMarkup ? `<div>${imageMarkup}</div>` : ""}
        <div class="min-w-0">
          <h2 class="font-serif text-[1.2rem] font-semibold leading-[1.16] tracking-tight text-gray-900 dark:text-white sm:text-[1.32rem]">
            <a href="${publicPath}" class="transition-colors duration-200 hover:text-gray-700 dark:text-gray-300">${title}</a>
          </h2>
          ${descriptionMarkup}
        </div>
      </div>
    </article>
  `;
}

export async function setupSearchPage() {
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
      if (requestId === currentRequestId) {
        setState("error");
      }
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
