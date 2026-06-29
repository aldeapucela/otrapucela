function getDeviceType() {
  return window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile";
}

function getPageType() {
  const explicitPageType = document.documentElement.dataset.pageType?.trim();

  if (explicitPageType) {
    return explicitPageType;
  }

  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/") {
    return "home";
  }

  if (pathname === "/boletin") {
    return "newsletter";
  }

  if (pathname === "/audios") {
    return "audios";
  }

  if (pathname.startsWith("/tema/")) {
    return "tema";
  }

  return "page";
}

function getArticleContext() {
  const articleContextElement = document.querySelector("[data-article-slug]");

  return {
    article_slug: articleContextElement?.dataset.articleSlug?.trim() || undefined,
    article_length_bucket: articleContextElement?.dataset.articleLengthBucket?.trim() || undefined
  };
}

function buildEventNameContext(extra = {}) {
  const baseContext = {
    page_type: getPageType(),
    device_type: getDeviceType(),
    ...getArticleContext()
  };

  const mergedContext = Object.fromEntries(
    Object.entries({
      ...baseContext,
      ...extra
    }).filter(([, value]) => typeof value !== "undefined" && value !== null && value !== "")
  );

  return JSON.stringify(mergedContext);
}

export function trackMatomoEvent(category, action, extra = {}, value) {
  if (typeof window._paq?.push !== "function") {
    return;
  }

  const payload = ["trackEvent", category, action, buildEventNameContext(extra)];

  if (typeof value !== "undefined") {
    payload.push(value);
  }

  window._paq.push(payload);
}

function observeElementView(element, onView, observerOptions) {
  if (!element || typeof onView !== "function") {
    return;
  }

  if (typeof window.IntersectionObserver !== "function") {
    onView();
    return;
  }

  const observer = new window.IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      observer.unobserve(entry.target);
      onView(entry.target);
    });
  }, observerOptions);

  observer.observe(element);
}

function setupModuleViewTracking() {
  const viewElements = document.querySelectorAll("[data-analytics-view]");
  const trackedViews = new Set();

  viewElements.forEach((element) => {
    const action = element.dataset.analyticsView?.trim();

    if (!action) {
      return;
    }

    observeElementView(
      element,
      (target) => {
        if (trackedViews.has(action)) {
          return;
        }

        trackedViews.add(action);
        trackMatomoEvent("modules", action, {
          module_location: target.dataset.analyticsLocation?.trim(),
          module_variant: target.dataset.analyticsVariant?.trim()
        });
      },
      {
        threshold: 0.35
      }
    );
  });
}

function setupModuleClickTracking() {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-analytics-click]")
      : null;

    if (!target) {
      return;
    }

    const action = target.dataset.analyticsClick?.trim();

    if (!action) {
      return;
    }

    trackMatomoEvent("modules", action, {
      module_location: target.dataset.analyticsLocation?.trim(),
      module_variant: target.dataset.analyticsVariant?.trim(),
      destination: target.getAttribute("href") || undefined
    });
  });
}

function setupArticleEngagementTracking() {
  const articleBody = document.querySelector(".article-body");

  if (!articleBody) {
    return;
  }

  const triggeredMilestones = new Set();
  const scrollMilestones = [
    { progress: 0.25, action: "scroll_25" },
    { progress: 0.5, action: "scroll_50" },
    { progress: 0.75, action: "scroll_75" },
    { progress: 0.9, action: "scroll_90" }
  ];
  const timeMilestones = [
    { delayMs: 30000, action: "time_30s" },
    { delayMs: 90000, action: "time_90s" }
  ];

  function triggerOnce(action) {
    if (triggeredMilestones.has(action)) {
      return;
    }

    triggeredMilestones.add(action);
    trackMatomoEvent("article_engagement", action);
  }

  function getScrollProgress() {
    const articleRect = articleBody.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const articleHeight = articleBody.offsetHeight;
    const totalScrollable = Math.max(articleHeight - viewportHeight, 1);
    const consumed = Math.min(Math.max(-articleRect.top, 0), totalScrollable);
    return consumed / totalScrollable;
  }

  const handleScroll = () => {
    const progress = getScrollProgress();

    scrollMilestones.forEach((milestone) => {
      if (progress >= milestone.progress) {
        triggerOnce(milestone.action);
      }
    });
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();

  timeMilestones.forEach((milestone) => {
    window.setTimeout(() => {
      triggerOnce(milestone.action);
    }, milestone.delayMs);
  });
}

export function setupModuleAnalytics() {
  setupModuleViewTracking();
  setupModuleClickTracking();
  setupArticleEngagementTracking();
}
