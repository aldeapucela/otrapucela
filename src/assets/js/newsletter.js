import {
  conditionalSubscriptionCooldownDays,
  conditionalSubscriptionScrollThreshold,
  conditionalSubscriptionStateStorageKey,
  conditionalSubscriptionVisitThreshold,
  newsletterEmailVerifiedStorageKey,
  newsletterSubscribedStorageKey,
  newsletterVisitedStorageKey
} from "./app-constants.js";
import {
  safelyReadJsonFromLocalStorage,
  safelyReadLocalStorage,
  safelyRemoveLocalStorage,
  safelyWriteLocalStorage,
  throttle
} from "./app-utils.js";

function getTodayStorageDate() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeConditionalSubscriptionState(state) {
  if (!state || typeof state !== "object") {
    return {
      firstVisitDate: undefined,
      visitedDaysCount: 0
    };
  }

  return {
    firstVisitDate: typeof state.firstVisitDate === "string"
      ? state.firstVisitDate
      : (
        typeof state.previousVisitDate === "string"
          ? state.previousVisitDate
          : (typeof state.lastVisitDate === "string" ? state.lastVisitDate : undefined)
      ),
    lastVisitDate: typeof state.lastVisitDate === "string" ? state.lastVisitDate : undefined,
    previousVisitDate: typeof state.previousVisitDate === "string" ? state.previousVisitDate : undefined,
    visitedDaysCount: Number.isFinite(Number(state.visitedDaysCount))
      ? Math.max(0, Number(state.visitedDaysCount))
      : 0,
    dismissedUntil: typeof state.dismissedUntil === "string" ? state.dismissedUntil : undefined,
    subscribed: state.subscribed === true
  };
}

function hasSubscribedToNewsletter() {
  const storedSubscriptionFlag = safelyReadLocalStorage(newsletterSubscribedStorageKey) === "true";
  const conditionalState = normalizeConditionalSubscriptionState(
    safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey)
  );

  return storedSubscriptionFlag || conditionalState.subscribed === true;
}

function setNewsletterSubscribed(subscribed) {
  if (subscribed) {
    safelyWriteLocalStorage(newsletterSubscribedStorageKey, "true");
  } else {
    safelyRemoveLocalStorage(newsletterSubscribedStorageKey);
  }

  const currentState = normalizeConditionalSubscriptionState(
    safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey)
  );

  safelyWriteLocalStorage(conditionalSubscriptionStateStorageKey, JSON.stringify({
    ...currentState,
    subscribed
  }));
}

function setNewsletterEmailVerified(verified) {
  if (verified) {
    safelyWriteLocalStorage(newsletterEmailVerifiedStorageKey, "true");
    return;
  }

  safelyRemoveLocalStorage(newsletterEmailVerifiedStorageKey);
}

export function syncNewsletterCtasVisibility() {
  const shouldHideNewsletterCtas = hasSubscribedToNewsletter();
  const newsletterCtas = document.querySelectorAll("[data-newsletter-cta]");

  newsletterCtas.forEach((element) => {
    element.classList.toggle("hidden", shouldHideNewsletterCtas);
  });
}

function updateConditionalSubscriptionVisitState() {
  const today = getTodayStorageDate();
  const rawState = safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey);
  const currentState = normalizeConditionalSubscriptionState(rawState);
  const hasStoredFirstVisitDate = !!(
    rawState
    && typeof rawState === "object"
    && typeof rawState.firstVisitDate === "string"
  );

  if (currentState.lastVisitDate === today) {
    if (!hasStoredFirstVisitDate) {
      const patchedState = {
        ...currentState,
        firstVisitDate: currentState.firstVisitDate || today
      };

      safelyWriteLocalStorage(conditionalSubscriptionStateStorageKey, JSON.stringify(patchedState));
      return patchedState;
    }

    return currentState;
  }

  const nextState = {
    ...currentState,
    firstVisitDate: currentState.firstVisitDate || today,
    previousVisitDate: currentState.lastVisitDate,
    lastVisitDate: today,
    visitedDaysCount: currentState.visitedDaysCount + 1
  };

  safelyWriteLocalStorage(conditionalSubscriptionStateStorageKey, JSON.stringify(nextState));
  return nextState;
}

function setupConditionalSubscriptionVisitTracking() {
  updateConditionalSubscriptionVisitState();
}

function setupConditionalSubscriptionModule() {
  const moduleElement = document.querySelector("[data-conditional-subscription]");
  const articleBody = document.querySelector(".article-body");

  if (!moduleElement || !articleBody) {
    return;
  }

  const closeButton = moduleElement.querySelector("[data-conditional-subscription-close]");
  const currentState = normalizeConditionalSubscriptionState(
    safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey)
  );
  const today = getTodayStorageDate();

  if (currentState.subscribed) {
    return;
  }

  if (currentState.dismissedUntil && currentState.dismissedUntil >= today) {
    return;
  }

  if (currentState.visitedDaysCount < conditionalSubscriptionVisitThreshold) {
    return;
  }

  let isVisible = false;
  let hasTriggered = false;

  function setVisible(visible) {
    isVisible = visible;

    if (visible) {
      moduleElement.dataset.ready = "true";
      window.setTimeout(() => {
        moduleElement.dataset.visible = "true";
        moduleElement.setAttribute("aria-hidden", "false");
      }, 24);
      return;
    }

    moduleElement.dataset.visible = "false";
    moduleElement.setAttribute("aria-hidden", "true");
  }

  function getScrollProgress() {
    const articleRect = articleBody.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const articleHeight = articleBody.offsetHeight;
    const totalScrollable = Math.max(articleHeight - viewportHeight, 1);
    const consumed = Math.min(Math.max(-articleRect.top, 0), totalScrollable);
    return consumed / totalScrollable;
  }

  const handleScroll = throttle(() => {
    if (hasTriggered || isVisible) {
      return;
    }

    if (getScrollProgress() < conditionalSubscriptionScrollThreshold) {
      return;
    }

    hasTriggered = true;
    setVisible(true);
  }, 100);

  closeButton?.addEventListener("click", () => {
    const dismissedUntil = new Date(Date.now() + (conditionalSubscriptionCooldownDays * 24 * 60 * 60 * 1000))
      .toISOString()
      .slice(0, 10);

    safelyWriteLocalStorage(conditionalSubscriptionStateStorageKey, JSON.stringify({
      ...normalizeConditionalSubscriptionState(
        safelyReadJsonFromLocalStorage(conditionalSubscriptionStateStorageKey)
      ),
      dismissedUntil
    }));

    setVisible(false);
  });

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();
}

function setupNewsletterHeaderState() {
  const newsletterHeaderLabel = document.querySelector("[data-newsletter-header-label]");
  const newsletterHeaderLink = document.querySelector("[data-newsletter-header-link]");

  if (!newsletterHeaderLabel || !newsletterHeaderLink) {
    return;
  }

  const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
  const hasVisitedNewsletter = safelyReadLocalStorage(newsletterVisitedStorageKey) === "true";

  if (currentPath === "/boletin") {
    safelyWriteLocalStorage(newsletterVisitedStorageKey, "true");
    newsletterHeaderLabel.classList.add("hidden");
    return;
  }

  if (hasVisitedNewsletter) {
    newsletterHeaderLabel.classList.add("hidden");
  }

  newsletterHeaderLink.addEventListener("click", () => {
    safelyWriteLocalStorage(newsletterVisitedStorageKey, "true");
  });
}

function setupNewsletterConfirmationState() {
  const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

  if (currentPath === "/boletin/gracias") {
    setNewsletterSubscribed(true);
    syncNewsletterCtasVisibility();
    return;
  }

  if (currentPath === "/boletin/confirmacion") {
    setNewsletterSubscribed(true);
    setNewsletterEmailVerified(true);
    syncNewsletterCtasVisibility();
  }
}

function setupNewsletterPageState() {
  const statusCard = document.querySelector("[data-newsletter-status]");
  const formSections = document.querySelectorAll("[data-newsletter-form]");
  const resetButton = document.querySelector("[data-newsletter-reset]");

  if (!statusCard || !formSections.length) {
    return;
  }

  function showSubscribedState() {
    statusCard.dataset.visible = "true";
    formSections.forEach((element) => {
      element.classList.add("hidden");
    });
  }

  function showSignupState() {
    delete statusCard.dataset.visible;
    formSections.forEach((element) => {
      element.classList.remove("hidden");
    });
  }

  if (hasSubscribedToNewsletter()) {
    showSubscribedState();
  } else {
    showSignupState();
  }

  resetButton?.addEventListener("click", () => {
    setNewsletterSubscribed(false);
    setNewsletterEmailVerified(false);
    syncNewsletterCtasVisibility();
    showSignupState();
  });
}

export function setupNewsletterFeatures() {
  setupConditionalSubscriptionVisitTracking();
  setupConditionalSubscriptionModule();
  setupNewsletterHeaderState();
  setupNewsletterConfirmationState();
  syncNewsletterCtasVisibility();
  setupNewsletterPageState();
}
