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

async function copyCurrentUrl() {
  const shareText = `${document.title}\n\n${window.location.href}`;
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
      await navigator.share({
        title: document.title,
        text: `${document.title}\n\n${window.location.href}`,
        url: window.location.href
      });
      return;
    }

    throw new Error("Web Share API not available");
  } catch {
    try {
      await copyCurrentUrl();
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

function normalizeCommentCount(topicPayload) {
  const postsCount = Number(topicPayload?.posts_count ?? 0);
  return Math.max(postsCount - 1, 0);
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

  try {
    const response = await fetch(topicJsonUrl, {
      headers: {
        Accept: "application/json"
      }
    });

    if (response.ok) {
      const topicPayload = await response.json();
      commentCount = normalizeCommentCount(topicPayload);
    }
  } catch {
    commentCount = initialReplies;
  }

  updateCommentCount(commentCount);

  if (commentCount > 0) {
    addCommentLink?.classList.remove("hidden");
    emptyState?.classList.add("hidden");
    embedContainer?.classList.remove("hidden");
    loadDiscourseEmbed(discourseUrl, topicId);
    return;
  }

  addCommentLink?.classList.add("hidden");
  embedContainer?.classList.add("hidden");
  emptyState?.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  setupHeaderAutoHide();
  setupHeaderMenu();
  setupShareButtons();
  setupRelatedCarousel();
  setupCommentsSection();
});
