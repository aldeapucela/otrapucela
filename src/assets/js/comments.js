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

const DISCOURSE_DARK_COLOR_SCHEME_ID = 1;
const EMBED_FALLBACK_DELAY_MS = 10000;
const FULL_APP_EMBED_OPTIONS = Object.freeze({
  fullApp: true,
  embedHeight: "720px",
  lazyLoad: true,
  lazyLoadMargin: "1000"
});

function getDiscourseColorScheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getDiscourseEmbedFrame(container = document) {
  if (!container?.querySelector) {
    return null;
  }

  return container.querySelector(
    'iframe#discourse-embed-frame, iframe[id^="discourse-embed"]'
  );
}

function loadDiscourseEmbed(discourseUrl, topicId) {
  if (!discourseUrl || !topicId) {
    return;
  }

  const existingEmbedScript = document.querySelector('script[data-js-discourse-embed="true"]');
  const existingEmbedFrame =
    document.getElementById("discourse-embed-frame") ??
    document.querySelector('iframe[id^="discourse-embed"]');

  if (existingEmbedScript && existingEmbedFrame) {
    return;
  }

  if (existingEmbedScript && !existingEmbedFrame) {
    existingEmbedScript.remove();
  }

  const isDark = getDiscourseColorScheme() === "dark";

  window.DiscourseEmbed = {
    ...FULL_APP_EMBED_OPTIONS,
    discourseUrl,
    topicId: Number(topicId),
    colorScheme: isDark ? "dark" : "light"
  };

  const embedScript = document.createElement("script");
  embedScript.src = `${discourseUrl}javascripts/embed.js`;
  embedScript.async = true;
  embedScript.dataset.jsDiscourseEmbed = "true";
  document.body.appendChild(embedScript);

  embedScript.addEventListener("load", () => {
    setTimeout(applyDiscourseColorSchemeToFrame, 1500);
  });
}

function applyDiscourseColorSchemeToFrame() {
  const embedFrame = getDiscourseEmbedFrame();

  if (!embedFrame || !embedFrame.src) {
    return;
  }

  try {
    const url = new URL(embedFrame.src);

    if (getDiscourseColorScheme() === "dark") {
      if (
        url.searchParams.get("color_scheme_id") ===
        String(DISCOURSE_DARK_COLOR_SCHEME_ID)
      ) {
        return;
      }
      url.searchParams.set("color_scheme_id", String(DISCOURSE_DARK_COLOR_SCHEME_ID));
    } else {
      if (!url.searchParams.has("color_scheme_id")) {
        return;
      }
      url.searchParams.delete("color_scheme_id");
    }

    embedFrame.src = url.toString();
  } catch {
    embedFrame.src = embedFrame.src;
  }
}

function setupCommentsEmbedVisibility(
  embedContainer,
  embedWrapper,
  loadingState,
  fallbackState,
  onEmbedReady
) {
  if (!embedContainer || !embedWrapper) {
    return {
      disconnect() {},
      sync() {
        return false;
      }
    };
  }

  const toggleEmbedVisibility = () => {
    const embedFrame = getDiscourseEmbedFrame(embedContainer);
    const hasIframe = Boolean(embedFrame);

    embedWrapper.classList.toggle("hidden", !hasIframe);
    loadingState?.classList.toggle("hidden", hasIframe);
    fallbackState?.classList.toggle("hidden", hasIframe);

    if (embedFrame) {
      embedFrame.setAttribute("title", "Comentarios");
    }

    return hasIframe;
  };

  const discourseUrl = embedContainer
    .closest(".js-comments-root")
    ?.dataset.discourseUrl;
  let discourseOrigin = null;

  try {
    discourseOrigin = discourseUrl ? new URL(discourseUrl).origin : null;
  } catch {
    discourseOrigin = null;
  }

  const handleEmbedMessage = (event) => {
    const embedFrame = getDiscourseEmbedFrame(embedContainer);
    const messageType =
      typeof event.data === "string"
        ? event.data
        : event.data?.type;

    if (
      !embedFrame ||
      event.source !== embedFrame.contentWindow ||
      (discourseOrigin && event.origin !== discourseOrigin) ||
      messageType !== "discourse-resize"
    ) {
      return;
    }

    onEmbedReady?.();
  };

  window.addEventListener("message", handleEmbedMessage);

  toggleEmbedVisibility();

  const observer = new MutationObserver(() => {
    if (toggleEmbedVisibility()) {
      observer.disconnect();
    }
  });

  observer.observe(embedContainer, {
    childList: true,
    subtree: true
  });

  return {
    disconnect() {
      observer.disconnect();
      window.removeEventListener("message", handleEmbedMessage);
    },
    sync: toggleEmbedVisibility
  };
}

function setupCommentsOverlayVisibility(commentsRoot) {
  if (!commentsRoot || !("IntersectionObserver" in window)) {
    return;
  }

  const floatingActions = document.querySelector(".js-floating-actions");
  const hasArticleAudio = Boolean(document.querySelector(".js-article-audio"));
  const mobileArticleBar = hasArticleAudio
    ? null
    : document.querySelector("[data-mobile-article-bar]");
  const overlays = [floatingActions, mobileArticleBar].filter(Boolean);

  if (!overlays.length) {
    return;
  }

  const setOverlaysHidden = (commentsInView) => {
    overlays.forEach((overlay) => {
      overlay.classList.toggle("hidden", commentsInView);
      overlay.toggleAttribute("inert", commentsInView);
      overlay.setAttribute("aria-hidden", String(commentsInView));
    });
  };

  const observer = new IntersectionObserver(([entry]) => {
    setOverlaysHidden(Boolean(entry?.isIntersecting));
  });

  observer.observe(commentsRoot);
}

export async function fetchTopicMetadata(topicJsonUrl, fallbackCount, fallbackLatestPostNumber = 2) {
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

export async function setupCommentsSection() {
  const commentsRoot = document.querySelector(".js-comments-root");

  if (!commentsRoot) {
    return;
  }

  setupCommentsOverlayVisibility(commentsRoot);

  const addCommentLink = commentsRoot.querySelector(".js-add-comment-link");
  const fallbackLink = commentsRoot.querySelector(".js-comments-fallback-link");
  const emptyState = commentsRoot.querySelector(".js-comments-empty-state");
  const loadingState = commentsRoot.querySelector(".js-comments-loading");
  const fallbackState = commentsRoot.querySelector(".js-comments-fallback");
  const embedContainer = commentsRoot.querySelector(".js-comments-embed");
  const embedWrapper = commentsRoot.querySelector(".js-comments-embed-wrapper");
  const discourseUrl = commentsRoot.dataset.discourseUrl;
  const topicId = commentsRoot.dataset.topicId;
  const topicUrl = commentsRoot.dataset.topicUrl;
  const topicJsonUrl = commentsRoot.dataset.topicJsonUrl;
  const initialReplies = Number(commentsRoot.dataset.initialReplies ?? 0);
  const isFullApp = commentsRoot.dataset.commentsMode === "full-app";

  let commentCount = initialReplies;
  let latestPostNumber = 2;
  let hasLoadedEmbed = false;
  let hasSeenEmbed = false;
  let fallbackTimer = null;

  const clearFallbackTimer = () => {
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  };

  const showEmbedFallback = () => {
    fallbackTimer = null;
    if (hasSeenEmbed) {
      return;
    }

    embedWrapper?.classList.add("hidden");
    loadingState?.classList.add("hidden");
    fallbackState?.classList.remove("hidden");
  };

  const scheduleEmbedFallback = () => {
    clearFallbackTimer();
    loadingState?.classList.remove("hidden");
    fallbackState?.classList.add("hidden");
    fallbackTimer = window.setTimeout(showEmbedFallback, EMBED_FALLBACK_DELAY_MS);
  };

  const handleEmbedReady = () => {
    hasSeenEmbed = true;
    clearFallbackTimer();
    embedWrapper?.classList.remove("hidden");
    loadingState?.classList.add("hidden");
    fallbackState?.classList.add("hidden");
  };

  let embedVisibilityController = setupCommentsEmbedVisibility(
    embedContainer,
    embedWrapper,
    loadingState,
    fallbackState,
    handleEmbedReady
  );

  function resetCommentsEmbed() {
    clearFallbackTimer();
    embedVisibilityController.disconnect();
    document.querySelector('script[data-js-discourse-embed="true"]')?.remove();
    document.getElementById("discourse-embed-frame")?.remove();
    document.querySelector('iframe[id^="discourse-embed"]')?.remove();

    if (embedContainer) {
      embedContainer.innerHTML = "";
    }

    embedWrapper?.classList.add("hidden");
    loadingState?.classList.remove("hidden");
    fallbackState?.classList.add("hidden");
    embedVisibilityController = setupCommentsEmbedVisibility(
      embedContainer,
      embedWrapper,
      loadingState,
      fallbackState,
      handleEmbedReady
    );
    hasLoadedEmbed = false;
    hasSeenEmbed = false;
  }

  function renderCommentsSection(nextCommentCount) {
    updateCommentCount(nextCommentCount);

    if (addCommentLink) {
      addCommentLink.href = buildTopicPostUrl(topicUrl, latestPostNumber);
      addCommentLink.classList.remove("hidden");
    }
    if (fallbackLink) {
      fallbackLink.href = buildTopicPostUrl(topicUrl, latestPostNumber);
    }

    if (isFullApp) {
      emptyState?.classList.toggle("hidden", nextCommentCount > 0);

      if (!hasLoadedEmbed) {
        loadDiscourseEmbed(discourseUrl, topicId);
        hasLoadedEmbed = true;
        scheduleEmbedFallback();
      }

      embedVisibilityController.sync();

      return;
    }

    if (nextCommentCount > 0) {
      emptyState?.classList.add("hidden");
      embedWrapper?.classList.remove("hidden");

      if (!hasLoadedEmbed) {
        loadDiscourseEmbed(discourseUrl, topicId);
        hasLoadedEmbed = true;
      }

      embedVisibilityController.sync();
      return;
    }

    embedWrapper?.classList.add("hidden");
    emptyState?.classList.remove("hidden");
    loadingState?.classList.add("hidden");
    fallbackState?.classList.add("hidden");
  }

  async function syncCommentsSection() {
    const topicMetadata = await fetchTopicMetadata(topicJsonUrl, commentCount, latestPostNumber);

    commentCount = topicMetadata.commentCount;
    latestPostNumber = topicMetadata.latestPostNumber;
    renderCommentsSection(commentCount);
  }

  await syncCommentsSection();

  window.setInterval(() => {
    if (!document.hidden) {
      syncCommentsSection();
    }
  }, 30000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      syncCommentsSection();
    }
  });

  window.addEventListener("pageshow", () => {
    const embedFrame = getDiscourseEmbedFrame();

    if (
      (isFullApp && hasSeenEmbed && !embedFrame) ||
      (!isFullApp && commentCount > 0 && !embedFrame)
    ) {
      resetCommentsEmbed();
    }

    syncCommentsSection();
  });
}

document.addEventListener("discourse-theme-changed", applyDiscourseColorSchemeToFrame);
