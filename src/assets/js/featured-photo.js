function normalizeFeaturedPhotoTitle(value = "", imageUrl = "") {
  const trimmedValue = String(value).trim();

  if (!trimmedValue) {
    return "";
  }

  const imageName = imageUrl.split("/").pop()?.toLowerCase() || "";
  const normalizedValue = trimmedValue.toLowerCase();
  const isFilenameTitle = normalizedValue === imageName
    || /^\d+\.(jpg|jpeg|png|webp|gif)$/i.test(trimmedValue);

  return isFilenameTitle ? "" : trimmedValue;
}

function parsePhotoFeedItem(itemElement, licenseUrl) {
  const title = itemElement.querySelector("title")?.textContent?.trim() || "";
  const sourceUrl = itemElement.querySelector("link")?.textContent?.trim() || "";
  const imageUrl = itemElement.querySelector("guid")?.textContent?.trim() || "";
  const publishedAt = itemElement.querySelector("pubDate")?.textContent?.trim() || "";
  const descriptionHtml = itemElement.querySelector("description")?.textContent?.trim() || "";

  if (!sourceUrl || !imageUrl || !descriptionHtml) {
    return null;
  }

  const parser = new DOMParser();
  const descriptionDocument = parser.parseFromString(descriptionHtml, "text/html");
  const paragraphElements = Array.from(descriptionDocument.querySelectorAll("p"));
  const rawDescription = paragraphElements
    .map((element) => element.textContent?.trim() || "")
    .filter(Boolean);
  const creditLine = rawDescription.find((value) => value.startsWith("Autor/a:")) || "";
  const visualDescription = rawDescription.find((value) => {
    if (value.startsWith("Autor/a:")) {
      return false;
    }

    return !/^ver original$/i.test(value);
  }) || "";
  const author = creditLine.replace(/^Autor\/a:\s*/i, "").replace(/\s*-\s*CC BY-SA 4\.0\s*$/i, "").trim();
  const normalizedTitle = normalizeFeaturedPhotoTitle(title, imageUrl);
  const finalDescription = visualDescription && visualDescription !== normalizedTitle
    ? visualDescription
    : "";
  const photoId = sourceUrl.split("#").pop()?.trim() || "";
  const canonicalPhotoUrl = photoId
    ? `https://fotos.aldeapucela.org/#${photoId}`
    : sourceUrl;

  return {
    title: normalizedTitle,
    description: finalDescription,
    author: author || "Comunidad Aldea Pucela",
    licenseName: "CC BY-SA 4.0",
    licenseUrl,
    imageUrl,
    sourceUrl: canonicalPhotoUrl,
    publishedAt
  };
}

function pickRandomPhoto(items) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

async function loadPhotoFeedItems(feedUrl) {
  const response = await fetch(feedUrl, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml"
    }
  });

  if (!response.ok) {
    throw new Error("Photo feed request failed");
  }

  const xmlText = await response.text();
  const xmlDocument = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = xmlDocument.querySelector("parsererror");

  if (parserError) {
    throw new Error("Photo feed parsing failed");
  }

  const licenseUrl = xmlDocument.querySelector("channel > creativeCommons\\:license, channel > license")
    ?.textContent?.trim()
    || "https://creativecommons.org/licenses/by-sa/4.0/deed.es";

  return Array.from(xmlDocument.querySelectorAll("item"))
    .map((itemElement) => parsePhotoFeedItem(itemElement, licenseUrl))
    .filter(Boolean);
}

function renderFeaturedPhotoCard(sectionElement, photo) {
  const imageElement = sectionElement.querySelector("[data-featured-photo-image]");

  if (!imageElement) {
    return;
  }

  imageElement.src = photo.imageUrl;
  imageElement.alt = photo.description || photo.title;
  sectionElement.classList.remove("hidden");
}

function trackFeaturedPhotoEvent(action, label = "unknown") {
  if (typeof window._paq?.push !== "function") {
    return;
  }

  window._paq.push(["trackEvent", "featured_photo", action, label]);
}

function setupFeaturedPhotoDialog(photo, onRequestAnotherPhoto = null) {
  const dialogElement = document.querySelector("[data-featured-photo-dialog]");

  if (!dialogElement || !photo) {
    return;
  }

  const imageElement = dialogElement.querySelector("[data-featured-photo-dialog-image]");
  const descriptionElement = dialogElement.querySelector("[data-featured-photo-dialog-description]");
  const authorElement = dialogElement.querySelector("[data-featured-photo-dialog-author]");
  const authorLinkElement = dialogElement.querySelector("[data-featured-photo-dialog-author-link]");
  const licenseElement = dialogElement.querySelector("[data-featured-photo-dialog-license]");
  const licenseLinkElement = dialogElement.querySelector("[data-featured-photo-dialog-license-link]");
  const sourceLinkElement = dialogElement.querySelector("[data-featured-photo-dialog-source]");
  const randomButtonElement = dialogElement.querySelector("[data-featured-photo-dialog-random]");
  const shareButtonElement = dialogElement.querySelector("[data-featured-photo-dialog-share]");
  const closeButton = dialogElement.querySelector("[data-featured-photo-close]");
  let lastTriggerElement = null;

  if (
    !imageElement
    || !descriptionElement
    || !authorElement
    || !authorLinkElement
    || !licenseElement
    || !licenseLinkElement
    || !sourceLinkElement
    || !randomButtonElement
    || !shareButtonElement
  ) {
    return;
  }

  imageElement.src = photo.imageUrl;
  imageElement.alt = photo.description || photo.title;
  descriptionElement.textContent = photo.description || photo.title || "";
  authorElement.textContent = photo.author;
  authorLinkElement.href = photo.sourceUrl;
  licenseElement.textContent = "CC BY-SA 4.0";
  licenseLinkElement.href = photo.licenseUrl;
  sourceLinkElement.href = photo.sourceUrl;
  sourceLinkElement.setAttribute("aria-label", photo.description || photo.title || photo.author);
  sourceLinkElement.setAttribute("title", photo.description || photo.title || photo.author);
  randomButtonElement.onclick = (event) => {
    event.preventDefault();

    if (typeof onRequestAnotherPhoto === "function") {
      onRequestAnotherPhoto("dialog");
    }
  };
  shareButtonElement.onclick = () => {
    trackFeaturedPhotoEvent("share_click", "dialog");
  };
  shareButtonElement.dataset.url = photo.sourceUrl;
  shareButtonElement.dataset.title = photo.description || photo.title || photo.author || "Foto";
  shareButtonElement.dataset.shareContentId = photo.sourceUrl;

  function closeDialog() {
    if (dialogElement.open) {
      dialogElement.close();
    }

    document.body.classList.remove("overflow-hidden");
    lastTriggerElement?.focus();
  }

  document.querySelectorAll("[data-featured-photo-open]").forEach((triggerElement) => {
    triggerElement.onclick = () => {
      lastTriggerElement = triggerElement;
      trackFeaturedPhotoEvent("open_dialog", "card");

      if (typeof dialogElement.showModal !== "function") {
        window.open(photo.sourceUrl, "_blank", "noopener");
        return;
      }

      dialogElement.showModal();
      document.body.classList.add("overflow-hidden");
    };
  });

  if (closeButton) {
    closeButton.onclick = closeDialog;
  }

  dialogElement.onclick = (event) => {
    const dialogBounds = dialogElement.getBoundingClientRect();
    const isBackdropClick =
      event.clientX < dialogBounds.left
      || event.clientX > dialogBounds.right
      || event.clientY < dialogBounds.top
      || event.clientY > dialogBounds.bottom;

    if (isBackdropClick) {
      closeDialog();
    }
  };

  dialogElement.onclose = () => {
    document.body.classList.remove("overflow-hidden");
    lastTriggerElement?.focus();
  };
}

export async function setupFeaturedPhoto() {
  const sections = document.querySelectorAll("[data-featured-photo]");

  if (!sections.length) {
    return;
  }

  const feedUrl = sections[0]?.dataset.featuredPhotoFeedUrl;

  if (!feedUrl) {
    return;
  }

  try {
    const photoItems = await loadPhotoFeedItems(feedUrl);
    let currentPhoto = pickRandomPhoto(photoItems);

    if (!currentPhoto) {
      return;
    }

    function renderCurrentPhoto() {
      sections.forEach((sectionElement) => {
        renderFeaturedPhotoCard(sectionElement, currentPhoto);
      });

      setupFeaturedPhotoDialog(currentPhoto, showAnotherPhoto);
    }

    function showAnotherPhoto(source = "unknown") {
      if (photoItems.length < 2) {
        return;
      }

      let nextPhoto = currentPhoto;

      while (nextPhoto?.sourceUrl === currentPhoto?.sourceUrl) {
        nextPhoto = pickRandomPhoto(photoItems);
      }

      currentPhoto = nextPhoto;
      trackFeaturedPhotoEvent("random_click", source);
      renderCurrentPhoto();
    }

    sections.forEach((sectionElement) => {
      const shuffleButton = sectionElement.querySelector("[data-featured-photo-shuffle]");

      shuffleButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showAnotherPhoto("card");
      });
    });

    renderCurrentPhoto();
  } catch {
    // Keep the homepage stable if the photo feed is unavailable.
  }
}
