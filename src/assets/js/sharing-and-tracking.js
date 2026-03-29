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

export function trackMatomoEvent(category, action, name, value) {
  if (typeof window._paq?.push !== "function") {
    return;
  }

  const payload = ["trackEvent", category, action];

  if (typeof name !== "undefined") {
    payload.push(name);
  }

  if (typeof value !== "undefined") {
    payload.push(value);
  }

  window._paq.push(payload);
}

function trackSubscriptionIntent(source) {
  trackMatomoEvent("subscription", "open_boletin", source || "unknown");
}

function withShareCampaign(rawUrl) {
  const url = new URL(rawUrl, window.location.origin);
  url.searchParams.set("mtm_campaign", "share");
  return url.toString();
}

function getSharePayload(buttonElement) {
  const currentUrl = window.location.href;
  const currentTitle = document.title;
  const canonicalPath = window.location.pathname;
  const explicitType = buttonElement.dataset.shareContentType;
  const pageType = explicitType || (canonicalPath === "/" ? "homepage" : "article");
  const contentId = buttonElement.dataset.shareContentId || (pageType === "homepage" ? "homepage" : canonicalPath);
  const homepageTitle = "La Otra Pucela - Informacion vecinal, util e independiente sobre Valladolid";
  const rawContentUrl = buttonElement.dataset.url || currentUrl;
  const contentTitle = buttonElement.dataset.title || (pageType === "homepage" ? homepageTitle : currentTitle);
  const contentUrl = pageType === "photo" ? rawContentUrl : withShareCampaign(rawContentUrl);
  const eventName = pageType === "homepage"
    ? "Home"
    : pageType === "article"
      ? String(contentId)
      : pageType === "newsletter"
        ? "Boletin"
        : contentUrl;

  return {
    contentTitle,
    contentUrl,
    eventName
  };
}

function trackShare(buttonElement, method) {
  const { eventName } = getSharePayload(buttonElement);
  trackMatomoEvent("share", method, eventName);
}

async function copyCurrentUrl(sharePayload) {
  const shareText = `${sharePayload.contentTitle}\n\n${sharePayload.contentUrl}`;
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
      const sharePayload = getSharePayload(buttonElement);

      try {
        await navigator.share({
          title: sharePayload.contentTitle,
          text: sharePayload.contentTitle,
          url: sharePayload.contentUrl
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          restoreShareButton(buttonElement);
          return;
        }

        throw error;
      }

      trackShare(buttonElement, "web_share");
      return;
    }

    throw new Error("Web Share API not available");
  } catch {
    try {
      await copyCurrentUrl(getSharePayload(buttonElement));
      trackShare(buttonElement, "clipboard");
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
  shareButtons.forEach((buttonElement) => {
    buttonElement.addEventListener("click", handleShareClick);
  });
}

function setupSubscriptionLinks() {
  const subscriptionLinks = document.querySelectorAll("[data-subscription-link]");
  subscriptionLinks.forEach((linkElement) => {
    const source = linkElement.dataset.subscriptionSource || "unknown";
    linkElement.addEventListener("click", () => {
      trackSubscriptionIntent(source);
    });
  });
}

export function setupSharingAndTracking() {
  setupShareButtons();
  setupSubscriptionLinks();
}
