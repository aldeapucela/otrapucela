import { normalizePathname } from "./app-utils.js";

let cachedArticlesIndex = null;
let cachedMostReadArticles = null;

export async function loadArticlesIndex() {
  if (cachedArticlesIndex) {
    return cachedArticlesIndex;
  }

  const response = await fetch("/api/articulos.json", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Articles request failed");
  }

  const payload = await response.json();
  cachedArticlesIndex = Array.isArray(payload?.items) ? payload.items : [];
  return cachedArticlesIndex;
}

export async function loadMostReadArticles() {
  if (cachedMostReadArticles) {
    return cachedMostReadArticles;
  }

  const [statsResponse, articles] = await Promise.all([
    fetch("https://proyectos.aldeapucela.org/exports/otrapucela/post-stats.json", {
      headers: {
        Accept: "application/json"
      }
    }),
    loadArticlesIndex()
  ]);

  if (!statsResponse.ok) {
    throw new Error("Most read stats request failed");
  }

  const statsPayload = await statsResponse.json();
  const statsItems = Array.isArray(statsPayload) ? statsPayload : [];
  const articlesByPath = new Map(
    articles
      .filter((article) => article?.publicPath)
      .map((article) => [normalizePathname(article.publicPath), article])
  );

  cachedMostReadArticles = statsItems
    .map((item) => {
      const path = normalizePathname(item?.label || item?.url);
      const article = articlesByPath.get(path);

      if (!article) {
        return null;
      }

      return {
        ...article,
        nbVisits: Number(item?.nb_visits ?? 0)
      };
    })
    .filter((article) => article?.publicPath)
    .filter((article, index, collection) => (
      collection.findIndex((entry) => entry.id === article.id) === index
    ));

  return cachedMostReadArticles;
}
