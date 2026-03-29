import {
  articleReadingAnchorSelector,
  articleReadingAnchorViewportOffset,
  articleReadingProgressCompletedThreshold,
  articleReadingProgressResumeHideThreshold,
  articleReadingProgressResumeThreshold,
  articleReadingProgressSaveThreshold,
  articleReadingProgressStorageKey,
  visitedArticlesStorageKey
} from "./app-constants.js";
import {
  safelyReadJsonFromLocalStorage,
  safelyWriteLocalStorage,
  throttle
} from "./app-utils.js";

function normalizeVisitedArticleIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

export function getVisitedArticleIds() {
  return normalizeVisitedArticleIds(
    safelyReadJsonFromLocalStorage(visitedArticlesStorageKey)
  );
}

export function setVisitedArticleIds(articleIds) {
  safelyWriteLocalStorage(
    visitedArticlesStorageKey,
    JSON.stringify(normalizeVisitedArticleIds(articleIds))
  );
}

function normalizeArticleReadingProgressStore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((store, [articleId, progress]) => {
    const normalizedArticleId = String(articleId ?? "").trim();

    if (!normalizedArticleId || !progress || typeof progress !== "object") {
      return store;
    }

    const ratio = Number(progress.ratio);
    const anchorRatio = Number(progress.anchorRatio);
    const anchorIndex = Number(progress.anchorIndex);
    const anchorOffset = Number(progress.anchorOffset);

    if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
      return store;
    }

    store[normalizedArticleId] = {
      ratio: Math.min(Math.max(ratio, 0), 1),
      anchorRatio: Number.isFinite(anchorRatio)
        ? Math.min(Math.max(anchorRatio, 0), 1)
        : Math.min(Math.max(ratio, 0), 1),
      anchorIndex: Number.isInteger(anchorIndex) && anchorIndex >= 0 ? anchorIndex : undefined,
      anchorOffset: Number.isFinite(anchorOffset) ? anchorOffset : undefined,
      updatedAt: typeof progress.updatedAt === "string" ? progress.updatedAt : undefined
    };

    return store;
  }, {});
}

function getArticleReadingProgressStore() {
  return normalizeArticleReadingProgressStore(
    safelyReadJsonFromLocalStorage(articleReadingProgressStorageKey)
  );
}

function setArticleReadingProgressStore(store) {
  safelyWriteLocalStorage(
    articleReadingProgressStorageKey,
    JSON.stringify(normalizeArticleReadingProgressStore(store))
  );
}

function getArticleReadingProgress(articleId) {
  const normalizedArticleId = String(articleId ?? "").trim();

  if (!normalizedArticleId) {
    return null;
  }

  const store = getArticleReadingProgressStore();
  return store[normalizedArticleId] ?? null;
}

function updateArticleReadingProgress(articleId, metrics) {
  const normalizedArticleId = String(articleId ?? "").trim();

  if (!normalizedArticleId) {
    return;
  }

  const store = getArticleReadingProgressStore();
  const ratio = Number(metrics?.ratio);
  const anchorRatio = Number(metrics?.anchorRatio);
  const anchorIndex = Number(metrics?.anchorIndex);
  const anchorOffset = Number(metrics?.anchorOffset);

  if (!Number.isFinite(ratio) || ratio < articleReadingProgressSaveThreshold) {
    return;
  }

  if (ratio >= articleReadingProgressCompletedThreshold) {
    delete store[normalizedArticleId];
    setArticleReadingProgressStore(store);
    return;
  }

  store[normalizedArticleId] = {
    ratio: Math.min(Math.max(ratio, 0), 1),
    anchorRatio: Number.isFinite(anchorRatio)
      ? Math.min(Math.max(anchorRatio, 0), 1)
      : Math.min(Math.max(ratio, 0), 1),
    anchorIndex: Number.isInteger(anchorIndex) && anchorIndex >= 0 ? anchorIndex : undefined,
    anchorOffset: Number.isFinite(anchorOffset) ? anchorOffset : undefined,
    updatedAt: new Date().toISOString()
  };

  setArticleReadingProgressStore(store);
}

function markCurrentArticleAsVisited() {
  const articleElement = document.querySelector("[data-article-id]");

  if (!articleElement) {
    return;
  }

  const articleId = articleElement.dataset.articleId?.trim();

  if (!articleId) {
    return;
  }

  const visitedArticleIds = getVisitedArticleIds();

  if (!visitedArticleIds.includes(articleId)) {
    setVisitedArticleIds([articleId, ...visitedArticleIds]);
  }
}

function setupArticleReadingProgress() {
  const articleElement = document.querySelector("[data-article-id]");
  const articleBody = document.querySelector(".article-body");
  const resumeLink = document.querySelector("[data-reading-resume-link]");

  if (!articleElement || !articleBody) {
    return;
  }

  const articleId = articleElement.dataset.articleId?.trim();

  if (!articleId) {
    return;
  }

  let resumeLinkDismissed = false;
  const anchorElements = Array.from(articleBody.querySelectorAll(articleReadingAnchorSelector));
  let resumeMarkerElement = null;

  function removeResumeMarker() {
    resumeMarkerElement?.remove();
    resumeMarkerElement = null;
  }

  function renderResumeMarker(progress) {
    removeResumeMarker();

    const storedAnchorIndex = Number(progress?.anchorIndex);

    if (!Number.isInteger(storedAnchorIndex) || storedAnchorIndex < 0 || !anchorElements[storedAnchorIndex]) {
      return;
    }

    const anchorElement = anchorElements[storedAnchorIndex];
    const markerElement = document.createElement("div");
    markerElement.className = "reading-resume-marker";
    markerElement.innerHTML = '<span class="reading-resume-marker__label">Te quedaste aquí</span>';
    anchorElement.parentNode?.insertBefore(markerElement, anchorElement);
    resumeMarkerElement = markerElement;
  }

  function getArticleScrollMetrics() {
    const articleRect = articleBody.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const articleHeight = articleBody.offsetHeight;
    const totalScrollable = Math.max(articleHeight - viewportHeight, 1);
    const consumed = Math.min(Math.max(-articleRect.top, 0), totalScrollable);
    const anchorRatio = articleHeight > 0 ? Math.min(Math.max(consumed / articleHeight, 0), 1) : 0;
    const targetLine = Math.min(
      Math.max(articleReadingAnchorViewportOffset, viewportHeight * 0.22),
      viewportHeight * 0.4
    );
    let closestAnchorIndex = -1;
    let closestAnchorOffset = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    anchorElements.forEach((element, index) => {
      const distance = Math.abs(element.getBoundingClientRect().top - targetLine);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestAnchorIndex = index;
        closestAnchorOffset = element.getBoundingClientRect().top - targetLine;
      }
    });

    return {
      articleRect,
      viewportHeight,
      articleHeight,
      totalScrollable,
      consumed,
      ratio: consumed / totalScrollable,
      anchorRatio,
      anchorIndex: closestAnchorIndex >= 0 ? closestAnchorIndex : undefined,
      anchorOffset: closestAnchorOffset
    };
  }

  function persistProgress() {
    updateArticleReadingProgress(articleId, getArticleScrollMetrics());
  }

  function scrollToProgress(progress) {
    const storedAnchorIndex = Number(progress?.anchorIndex);
    const storedAnchorOffset = Number(progress?.anchorOffset);
    const targetLine = Math.min(
      Math.max(articleReadingAnchorViewportOffset, window.innerHeight * 0.22),
      window.innerHeight * 0.4
    );

    if (Number.isInteger(storedAnchorIndex) && storedAnchorIndex >= 0 && anchorElements[storedAnchorIndex]) {
      const anchorElement = anchorElements[storedAnchorIndex];
      const anchorTop = window.scrollY + anchorElement.getBoundingClientRect().top;
      const targetY = anchorTop - targetLine - (Number.isFinite(storedAnchorOffset) ? storedAnchorOffset : 0);

      window.scrollTo({
        top: Math.max(targetY, 0),
        behavior: "smooth"
      });
      return;
    }

    const articleHeight = articleBody.offsetHeight;
    const articleTop = window.scrollY + articleBody.getBoundingClientRect().top;
    const fallbackRatio = Number(progress?.ratio);
    const anchorRatio = Number.isFinite(Number(progress?.anchorRatio))
      ? Number(progress.anchorRatio)
      : fallbackRatio;
    const targetY = articleTop + (articleHeight * Math.min(Math.max(anchorRatio, 0), 1));

    window.scrollTo({
      top: Math.max(targetY, 0),
      behavior: "smooth"
    });
  }

  if (resumeLink) {
    function showResumeLink() {
      const currentProgress = getArticleScrollMetrics().ratio;
      const latestSavedProgress = getArticleReadingProgress(articleId);

      if (
        resumeLinkDismissed
        || currentProgress > 0.04
        || !latestSavedProgress
        || latestSavedProgress.ratio < articleReadingProgressResumeThreshold
      ) {
        return;
      }

      renderResumeMarker(latestSavedProgress);
      resumeLink.classList.remove("hidden");
      resumeLink.setAttribute("aria-hidden", "false");
    }

    function hideResumeLink() {
      resumeLink.classList.add("hidden");
      resumeLink.setAttribute("aria-hidden", "true");
    }

    showResumeLink();

    resumeLink.addEventListener("click", () => {
      const latestSavedProgress = getArticleReadingProgress(articleId);
      hideResumeLink();

      if (latestSavedProgress) {
        scrollToProgress(latestSavedProgress);
      }
    });

    window.addEventListener("scroll", throttle(() => {
      if (getArticleScrollMetrics().ratio > articleReadingProgressResumeHideThreshold) {
        resumeLinkDismissed = true;
        hideResumeLink();
      }
    }, 120), { passive: true });
  } else {
    removeResumeMarker();
  }

  const handleScroll = throttle(() => {
    persistProgress();
  }, 300);

  function persistProgressImmediately() {
    handleScroll.flush?.();
    persistProgress();
  }

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("beforeunload", persistProgressImmediately);
  window.addEventListener("pagehide", persistProgressImmediately);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persistProgressImmediately();
    }
  });
}

export function setupReadingProgressFeatures() {
  markCurrentArticleAsVisited();
  setupArticleReadingProgress();
}
