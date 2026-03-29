import { throttle } from "./app-utils.js";

function setupHeaderAutoHide() {
  const headerElement = document.querySelector("#js-header");

  if (!headerElement) {
    return;
  }

  let lastScrollY = window.scrollY;

  const handleScroll = throttle(() => {
    if (document.documentElement.classList.contains("menu-open")) {
      headerElement.classList.remove("-translate-y-full");
      lastScrollY = window.scrollY;
      return;
    }

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

function setupPwaRegistration() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

function setupContactFormLoadingState() {
  const iframeElement = document.querySelector("[data-contact-form-iframe]");
  const loadingElement = document.querySelector("[data-contact-form-loading]");

  if (!iframeElement || !loadingElement) {
    return;
  }

  let hasCompletedLoad = false;

  function revealForm() {
    if (hasCompletedLoad) {
      return;
    }

    hasCompletedLoad = true;
    loadingElement.setAttribute("data-hidden", "true");
    iframeElement.classList.remove("opacity-0");
    iframeElement.classList.add("opacity-100");
  }

  iframeElement.addEventListener("load", revealForm, { once: true });
  window.setTimeout(revealForm, 5000);
}

function setupHeaderMenu() {
  const menuToggleButton = document.querySelector(".js-menu-toggle");
  const menuPanel = document.querySelector(".js-menu-panel");
  const headerElement = document.querySelector("#js-header");
  let menuScrollY = 0;

  if (!menuToggleButton || !menuPanel || !headerElement) {
    return;
  }

  function syncMenuViewport() {
    const headerHeight = Math.round(headerElement.getBoundingClientRect().height);
    menuPanel.style.maxHeight = `calc(100dvh - ${headerHeight}px)`;
  }

  function closeMenu() {
    menuPanel.classList.add("hidden");
    menuToggleButton.setAttribute("aria-expanded", "false");
    headerElement.classList.remove("menu-open-header", "-translate-y-full");
    document.documentElement.classList.remove("menu-open");
    document.body.classList.remove("menu-open");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    window.scrollTo(0, menuScrollY);
  }

  function openMenu() {
    menuScrollY = window.scrollY;
    headerElement.classList.remove("-translate-y-full");
    headerElement.classList.add("menu-open-header");
    syncMenuViewport();
    menuPanel.classList.remove("hidden");
    menuToggleButton.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("menu-open");
    document.body.classList.add("menu-open");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    menuPanel.scrollTop = 0;
  }

  menuToggleButton.addEventListener("click", () => {
    const isExpanded = menuToggleButton.getAttribute("aria-expanded") === "true";
    if (isExpanded) {
      closeMenu();
      return;
    }
    openMenu();
  });

  window.addEventListener("resize", syncMenuViewport, { passive: true });
  window.addEventListener("orientationchange", syncMenuViewport);

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

  syncMenuViewport();
}

function setupArticleRailCarousels() {
  const sections = document.querySelectorAll("section");

  sections.forEach((section) => {
    const viewportElement = section.querySelector("[data-carousel-viewport], .js-related-viewport");
    const trackElement = section.querySelector("[data-carousel-track], .js-related-track");
    const previousButton = section.querySelector("[data-carousel-prev], .js-related-prev");
    const nextButton = section.querySelector("[data-carousel-next], .js-related-next");
    const controlsElement = previousButton?.parentElement;

    if (!viewportElement || !trackElement || !previousButton || !nextButton) {
      return;
    }

    function syncCarouselControlsVisibility() {
      if (!controlsElement) {
        return;
      }

      const hasOverflow = trackElement.scrollWidth - viewportElement.clientWidth > 8;
      controlsElement.classList.toggle("lg:flex", hasOverflow);
      controlsElement.classList.toggle("lg:hidden", !hasOverflow);
    }

    function scrollTrack(direction) {
      const firstCard = trackElement.querySelector("article");
      const trackStyles = window.getComputedStyle(trackElement);
      const gap = Number.parseFloat(trackStyles.columnGap || trackStyles.gap || "0") || 0;
      const scrollStep = firstCard
        ? firstCard.getBoundingClientRect().width + gap
        : viewportElement.clientWidth * 0.8;

      viewportElement.scrollBy({
        left: direction * scrollStep,
        behavior: "smooth"
      });
    }

    previousButton.addEventListener("click", () => {
      scrollTrack(-1);
    });

    nextButton.addEventListener("click", () => {
      scrollTrack(1);
    });

    syncCarouselControlsVisibility();
    window.addEventListener("resize", syncCarouselControlsVisibility, { passive: true });
  });
}

function setupScrollTopButton() {
  const scrollTopButton = document.querySelector(".js-scroll-top");
  const scrollThemeButton = document.querySelector(".js-scroll-theme-toggle");
  const scrollShareButton = document.querySelector(".js-scroll-share-btn");

  if (!scrollTopButton) {
    return;
  }

  function syncScrollTopButton() {
    const shouldShow = window.scrollY > 520;

    scrollTopButton.classList.toggle("pointer-events-none", !shouldShow);
    scrollTopButton.classList.toggle("opacity-0", !shouldShow);
    scrollTopButton.classList.toggle("translate-y-3", !shouldShow);
    scrollTopButton.classList.toggle("opacity-100", shouldShow);
    scrollTopButton.classList.toggle("translate-y-0", shouldShow);

    [scrollThemeButton, scrollShareButton].forEach((buttonElement) => {
      if (!buttonElement) {
        return;
      }

      buttonElement.classList.toggle("pointer-events-none", !shouldShow);
      buttonElement.classList.toggle("opacity-0", !shouldShow);
      buttonElement.classList.toggle("translate-y-3", !shouldShow);
      buttonElement.classList.toggle("opacity-100", shouldShow);
      buttonElement.classList.toggle("translate-y-0", shouldShow);
    });
  }

  scrollTopButton.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  syncScrollTopButton();
  window.addEventListener("scroll", syncScrollTopButton, { passive: true });
}

export function setupCoreUi() {
  setupPwaRegistration();
  setupContactFormLoadingState();
  setupHeaderAutoHide();
  setupHeaderMenu();
  setupArticleRailCarousels();
  setupScrollTopButton();
}
