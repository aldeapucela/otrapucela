function bindDialogInteractions(dialogElement, {
  onClose,
  onAfterClose,
  surfaceElement = dialogElement,
  isOpen = () => Boolean(dialogElement?.open),
  closeOnBackdrop = true,
  closeOnCancel = true,
  closeOnEscape = false
} = {}) {
  if (!dialogElement) {
    return {
      open() {},
      close() {}
    };
  }

  function closeDialog() {
    onClose?.();

    if (dialogElement.open) {
      dialogElement.close();
    }

    onAfterClose?.();
  }

  function openDialog() {
    if (typeof dialogElement.showModal !== "function") {
      return false;
    }

    dialogElement.showModal();
    return true;
  }

  if (closeOnBackdrop) {
    dialogElement.addEventListener("click", (event) => {
      const dialogBounds = surfaceElement.getBoundingClientRect();
      const isBackdropClick =
        event.clientX < dialogBounds.left
        || event.clientX > dialogBounds.right
        || event.clientY < dialogBounds.top
        || event.clientY > dialogBounds.bottom;

      if (isBackdropClick) {
        closeDialog();
      }
    });
  }

  if (closeOnCancel) {
    dialogElement.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog();
    });
  }

  if (closeOnEscape) {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !isOpen()) {
        return;
      }

      event.preventDefault();
      closeDialog();
    });
  }

  return {
    open: openDialog,
    close: closeDialog
  };
}

function setupInstallPrompt() {
  const triggerElement = document.querySelector(".js-install-app-trigger");
  const descriptionElement = document.querySelector(".js-install-app-description");
  const dialogElement = document.querySelector("[data-install-dialog]");

  if (!triggerElement || !dialogElement || !descriptionElement) {
    return;
  }

  const closeButtons = dialogElement.querySelectorAll("[data-install-close]");
  const copyElement = dialogElement.querySelector(".js-install-dialog-copy");
  const stepsElement = dialogElement.querySelector(".js-install-steps");
  const confirmButton = dialogElement.querySelector(".js-install-app-confirm");
  const confirmLabel = dialogElement.querySelector(".js-install-app-confirm-label");
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  let deferredPrompt = null;
  let mode = null;
  const dialogController = bindDialogInteractions(dialogElement, {
    onAfterClose() {
      document.body.classList.remove("overflow-hidden");
      triggerElement.focus();
    }
  });

  function applyMode(nextMode) {
    mode = nextMode;

    if (!copyElement || !stepsElement || !confirmLabel) {
      return;
    }

    if (mode === "ios") {
      triggerElement.classList.remove("hidden");
      triggerElement.classList.add("inline-flex");
      descriptionElement.textContent = "Guarda el medio como acceso directo desde Safari.";
      copyElement.textContent = "En iPhone y iPad debes hacerlo manualmente desde el menú de compartir de Safari.";
      stepsElement.innerHTML = `
        <li>1. Abre esta web en Safari.</li>
        <li>2. Pulsa el botón Compartir (cuadrado con flecha hacia arriba).</li>
        <li>3. Desplázate y toca “Añadir a pantalla de inicio”.</li>
        <li>4. Confirma el nombre y pulsa “Añadir”.</li>
      `;
      confirmLabel.textContent = "Entendido";
      return;
    }

    if (mode === "install") {
      triggerElement.classList.remove("hidden");
      triggerElement.classList.add("inline-flex");
      descriptionElement.textContent = "Instálala en tu móvil para abrirla con un toque.";
      copyElement.textContent = "Tu navegador puede añadir La Otra Pucela a la pantalla de inicio como acceso directo instalable.";
      stepsElement.innerHTML = `
        <li>1. Pulsa el botón de abajo.</li>
        <li>2. Revisa el diálogo de instalación de tu navegador.</li>
        <li>3. Confirma la instalación para añadirla a tu pantalla de inicio.</li>
      `;
      confirmLabel.textContent = "Añadir ahora";
      return;
    }

    triggerElement.classList.add("hidden");
    triggerElement.classList.remove("inline-flex");
  }

  async function handleConfirm() {
    if (mode === "install" && deferredPrompt) {
      deferredPrompt.prompt();

      try {
        await deferredPrompt.userChoice;
      } catch {
        // Ignore prompt dismissal and keep the menu action available.
      }

      deferredPrompt = null;
      dialogController.close();
      applyMode(null);
      return;
    }

    dialogController.close();
  }

  triggerElement.addEventListener("click", () => {
    if (dialogController.open()) {
      document.body.classList.add("overflow-hidden");
    }
  });
  confirmButton?.addEventListener("click", handleConfirm);

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      dialogController.close();
    });
  });

  if (isStandalone) {
    applyMode(null);
    return;
  }

  if (isIos) {
    applyMode("ios");
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    applyMode("install");
  });
}

function setupArticleImageLightbox() {
  const articleBody = document.querySelector(".article-body");

  if (!articleBody) {
    return;
  }

  const imageElements = Array.from(articleBody.querySelectorAll("img"))
    .filter((imageElement) => !imageElement.classList.contains("emoji"));

  if (!imageElements.length) {
    return;
  }

  const lightboxElement = document.querySelector("[data-article-lightbox]");
  const dialogElement = lightboxElement?.querySelector("[role='dialog']");
  const lightboxImageElement = lightboxElement?.querySelector("[data-article-lightbox-image]");
  const captionElement = lightboxElement?.querySelector("[data-article-lightbox-caption]");
  const closeButton = lightboxElement?.querySelector("[data-article-lightbox-close]");

  if (!lightboxElement || !dialogElement || !lightboxImageElement || !captionElement) {
    return;
  }

  let previousActiveElement = null;
  const dialogController = bindDialogInteractions(lightboxElement, {
    surfaceElement: dialogElement,
    isOpen: () => lightboxElement.dataset.open === "true",
    closeOnCancel: false,
    closeOnEscape: true,
    onClose() {
      lightboxElement.dataset.open = "false";
      lightboxElement.setAttribute("aria-hidden", "true");
      document.body.classList.remove("overflow-hidden");

      window.setTimeout(() => {
        if (lightboxElement.dataset.open === "true") {
          return;
        }

        lightboxElement.setAttribute("hidden", "");
        lightboxImageElement.removeAttribute("src");
        lightboxImageElement.alt = "";
        captionElement.textContent = "";
        captionElement.classList.add("hidden");
      }, 220);
    },
    onAfterClose() {
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    }
  });

  function getImageCaption(imageElement) {
    if (!imageElement) {
      return "";
    }

    const role = imageElement.getAttribute("role")?.trim().toLowerCase();
    const altText = imageElement.alt?.trim() || "";
    const titleText = imageElement.getAttribute("title")?.trim() || "";

    if (role === "presentation") {
      return titleText;
    }

    return altText || titleText;
  }

  function injectInlineCaption(imageElement, caption) {
    if (!caption) {
      return;
    }

    const anchorElement = imageElement.closest("a");
    const targetElement = anchorElement && articleBody.contains(anchorElement)
      ? anchorElement
      : imageElement;

    if (targetElement.parentElement?.classList.contains("article-inline-media")) {
      const existingCaption = targetElement.parentElement.querySelector(".article-inline-caption");

      if (existingCaption) {
        existingCaption.textContent = caption;
      }

      return;
    }

    const wrapperElement = document.createElement("figure");
    wrapperElement.className = "article-inline-media";
    targetElement.insertAdjacentElement("beforebegin", wrapperElement);
    wrapperElement.appendChild(targetElement);

    const nextCaptionElement = document.createElement("figcaption");
    nextCaptionElement.className = "article-inline-caption";
    nextCaptionElement.textContent = caption;
    nextCaptionElement.setAttribute("aria-hidden", "true");
    wrapperElement.appendChild(nextCaptionElement);
  }

  function openLightbox(imageElement) {
    const source = imageElement.currentSrc || imageElement.src;

    if (!source) {
      return;
    }

    previousActiveElement = imageElement;
    lightboxImageElement.src = source;
    lightboxImageElement.alt = imageElement.alt || "";

    const caption = getImageCaption(imageElement);
    captionElement.textContent = caption;
    captionElement.classList.toggle("hidden", !caption);

    lightboxElement.removeAttribute("hidden");

    requestAnimationFrame(() => {
      lightboxElement.dataset.open = "true";
      lightboxElement.setAttribute("aria-hidden", "false");
      document.body.classList.add("overflow-hidden");
      closeButton?.focus();
    });
  }

  imageElements.forEach((imageElement) => {
    const caption = getImageCaption(imageElement);
    injectInlineCaption(imageElement, caption);

    imageElement.dataset.lightboxImage = "true";
    imageElement.tabIndex = 0;
    imageElement.setAttribute("role", "button");
    imageElement.setAttribute(
      "aria-label",
      caption ? `Ampliar imagen: ${caption}` : "Ampliar imagen"
    );

    imageElement.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      if (imageElement.closest("a")) {
        event.preventDefault();
      }

      openLightbox(imageElement);
    });

    imageElement.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openLightbox(imageElement);
    });
  });

  closeButton?.addEventListener("click", () => {
    dialogController.close();
  });
}

function setupRssDialog() {
  const triggerElements = document.querySelectorAll("[data-rss-trigger]");
  const dialogElement = document.querySelector("[data-rss-dialog]");

  if (!triggerElements.length || !dialogElement) {
    return;
  }

  const [primaryTriggerElement] = triggerElements;
  const closeButton = dialogElement.querySelector("[data-rss-close]");
  const copyButtons = dialogElement.querySelectorAll("[data-rss-copy]");
  const feedInputs = dialogElement.querySelectorAll("[data-rss-feed-input]");
  const readerLinks = dialogElement.querySelectorAll("[data-rss-reader]");
  const podcastServiceLinks = dialogElement.querySelectorAll("[data-podcast-service]");
  const feedUrl = primaryTriggerElement.dataset.feedUrl || primaryTriggerElement.href;
  const podcastUrl = primaryTriggerElement.dataset.podcastUrl || "";
  let lastTriggerElement = primaryTriggerElement;
  const dialogController = bindDialogInteractions(dialogElement, {
    onAfterClose() {
      document.body.classList.remove("overflow-hidden");
      lastTriggerElement?.focus();
    }
  });

  if (!feedUrl || !feedInputs.length) {
    return;
  }

  const feedUrls = {
    rss: feedUrl,
    podcast: podcastUrl
  };

  feedInputs.forEach((inputElement) => {
    const inputType = inputElement.dataset.rssFeedInput;
    const url = feedUrls[inputType];

    if (url) {
      inputElement.value = url;
    }
  });

  const readerUrls = {
    feedly: `https://feedly.com/i/subscription/feed/${encodeURIComponent(feedUrl)}`,
    inoreader: `https://www.inoreader.com/?add_feed=${encodeURIComponent(feedUrl)}`,
    newsblur: `https://www.newsblur.com/?url=${encodeURIComponent(feedUrl)}`,
    theoldreader: `https://theoldreader.com/feeds/subscribe?url=${encodeURIComponent(feedUrl)}`
  };

  readerLinks.forEach((linkElement) => {
    const readerName = linkElement.dataset.rssReader;
    const readerUrl = readerUrls[readerName];
    if (readerUrl) {
      linkElement.href = readerUrl;
    }
  });

  const podcastServiceUrls = {
    spotify: primaryTriggerElement.dataset.spotifyUrl || "",
    apple: primaryTriggerElement.dataset.appleUrl || "",
    antennapod: `https://antennapod.org/deeplink/subscribe?url=${encodeURIComponent(podcastUrl)}&title=${encodeURIComponent("La Otra Pucela en audio")}`,
    overcast: `overcast://x-callback-url/add?url=${encodeURIComponent(podcastUrl)}`
  };

  podcastServiceLinks.forEach((linkElement) => {
    const serviceName = linkElement.dataset.podcastService;
    const serviceUrl = podcastServiceUrls[serviceName];
    if (serviceUrl) {
      linkElement.href = serviceUrl;
    }
  });

  function openDialog(defaultFeedType = "rss") {
    if (!dialogController.open()) {
      window.location.href = feedUrls[defaultFeedType] || feedUrl;
      return;
    }
    document.body.classList.add("overflow-hidden");

    window.setTimeout(() => {
      const defaultSectionElement = dialogElement.querySelector(`[data-rss-feed-section="${defaultFeedType}"]`)
        || dialogElement.querySelector('[data-rss-feed-section="rss"]');
      const defaultInputElement = dialogElement.querySelector(`[data-rss-feed-input="${defaultFeedType}"]`)
        || dialogElement.querySelector('[data-rss-feed-input="rss"]');

      defaultSectionElement?.scrollIntoView({
        block: "start",
        behavior: "auto"
      });

      defaultInputElement?.focus({ preventScroll: true });
      defaultInputElement?.select();
    }, 30);
  }

  async function copyFeedUrl(feedType) {
    const nextFeedUrl = feedUrls[feedType];
    const inputElement = dialogElement.querySelector(`[data-rss-feed-input="${feedType}"]`);
    const copyLabel = dialogElement.querySelector(`[data-rss-copy-label="${feedType}"]`);

    if (!nextFeedUrl || !inputElement || !copyLabel) {
      return;
    }

    try {
      await navigator.clipboard.writeText(nextFeedUrl);
      copyLabel.textContent = "Copiada";
    } catch {
      inputElement.focus();
      inputElement.select();
      copyLabel.textContent = "Seleccionada";
    }

    window.setTimeout(() => {
      copyLabel.textContent = "Copiar";
    }, 2200);
  }

  triggerElements.forEach((triggerElement) => {
    triggerElement.addEventListener("click", (event) => {
      event.preventDefault();
      lastTriggerElement = triggerElement;
      openDialog(triggerElement.dataset.defaultFeed || "rss");
    });
  });

  closeButton?.addEventListener("click", () => {
    dialogController.close();
  });
  copyButtons.forEach((buttonElement) => {
    buttonElement.addEventListener("click", () => {
      copyFeedUrl(buttonElement.dataset.rssCopy);
    });
  });
}

export function setupDialogs() {
  setupInstallPrompt();
  setupArticleImageLightbox();
  setupRssDialog();
}
