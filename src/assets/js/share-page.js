function trackMatomoEvent(category, action, name, value) {
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

function sanitizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeInternalUrl(rawValue, fallback = "/") {
  try {
    const parsedUrl = new URL(String(rawValue ?? ""), window.location.origin);
    if (parsedUrl.origin !== window.location.origin) {
      return fallback;
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return fallback;
  }
}

function sanitizeImageUrl(rawValue) {
  try {
    const parsedUrl = new URL(String(rawValue ?? ""), window.location.origin);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return "";
    }

    return parsedUrl.toString();
  } catch {
    return "";
  }
}

function withShareCampaign(rawUrl) {
  const url = new URL(rawUrl, window.location.origin);
  url.searchParams.set("mtm_campaign", "share");
  return url.toString();
}

function createSharePayload(article) {
  const safePublicPath = sanitizeInternalUrl(article.publicPath, window.location.pathname);

  return {
    title: sanitizeText(article.title) || document.title,
    url: withShareCampaign(safePublicPath || window.location.href),
    eventName: String(article.id || "unknown"),
    source: "share_landing"
  };
}

function setShareButtonFeedback(buttonElement, labelText, iconClass) {
  const iconElement = buttonElement.querySelector("[data-share-icon]");
  const labelElement = buttonElement.querySelector("[data-share-label]");

  if (iconElement) {
    iconElement.className = iconClass;
  }

  if (labelElement) {
    labelElement.textContent = labelText;
  }
}

function restoreShareButton(buttonElement) {
  setShareButtonFeedback(
    buttonElement,
    buttonElement.dataset.originalLabel || "Compartir este artículo",
    buttonElement.dataset.originalIcon || "fa-solid fa-share-nodes text-base"
  );
}

async function copySharePayload(sharePayload) {
  const shareText = `${sharePayload.title}\n\n${sharePayload.url}`;
  await navigator.clipboard.writeText(shareText);
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (typeof textContent === "string") {
    element.textContent = textContent;
  }

  return element;
}

function createShell() {
  const sectionElement = createElement("section", "relative z-10 mx-auto w-full max-w-md");
  const articleElement = createElement(
    "article",
    "overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_20px_70px_-30px_rgba(31,41,55,0.4)] backdrop-blur-sm dark:border-gray-700 dark:bg-[#1a2529]"
  );

  sectionElement.append(articleElement);

  return {
    sectionElement,
    articleElement
  };
}

function renderIntoRoot(node) {
  const rootElement = document.querySelector("[data-share-app]");

  if (!rootElement) {
    return null;
  }

  rootElement.replaceChildren(node);
  return rootElement;
}

function renderError(message) {
  const safeMessage = sanitizeText(message);
  const shell = createShell();
  const contentElement = createElement("div", "p-8 text-center");
  const titleElement = createElement(
    "h1",
    "font-serif text-[1.9rem] font-semibold leading-[1.08] tracking-tight text-[#1c2731] dark:text-white",
    "No hemos encontrado ese artículo"
  );
  const messageElement = createElement(
    "p",
    "mt-4 text-base leading-7 text-[#5b6470] dark:text-gray-300",
    safeMessage
  );
  const homeLinkElement = createElement(
    "a",
    "mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#20313a] px-5 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#16232b] dark:bg-[#e8dcc8] dark:text-[#1a2529] dark:hover:bg-[#dccbb0]",
    "Ir a portada"
  );

  homeLinkElement.href = "/";

  contentElement.append(titleElement, messageElement, homeLinkElement);
  shell.articleElement.append(contentElement);

  renderIntoRoot(shell.sectionElement);
}

function createImageBlock(articleImage, articleTitle) {
  const imageWrapper = createElement(
    "div",
    "relative aspect-[16/10] w-full overflow-hidden bg-[#e8e0d2] dark:bg-[#24313a]"
  );
  const imageElement = document.createElement("img");
  const overlayElement = createElement(
    "div",
    "absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent"
  );

  imageElement.src = articleImage;
  imageElement.alt = articleTitle;
  imageElement.className = "h-full w-full object-cover";
  imageElement.loading = "eager";

  imageWrapper.append(imageElement, overlayElement);

  return imageWrapper;
}

function createShareButton() {
  const buttonElement = createElement(
    "button",
    "inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-[#20313a] px-5 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#16232b] dark:bg-[#e8dcc8] dark:text-[#1a2529] dark:hover:bg-[#dccbb0]"
  );
  const iconElement = createElement("i", "fa-solid fa-share-nodes text-base");
  const labelElement = createElement("span", "", "Compartir este artículo");

  buttonElement.type = "button";
  buttonElement.dataset.shareButton = "";
  buttonElement.dataset.originalLabel = "Compartir este artículo";
  buttonElement.dataset.originalIcon = "fa-solid fa-share-nodes text-base";
  iconElement.dataset.shareIcon = "";
  iconElement.setAttribute("aria-hidden", "true");
  labelElement.dataset.shareLabel = "";

  buttonElement.append(iconElement, labelElement);

  return buttonElement;
}

function createArticleLink(articlePath) {
  const linkElement = createElement(
    "a",
    "inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#d8cdbd] bg-[#fbf8f2] px-5 py-3 text-sm font-semibold text-[#43515d] transition-colors duration-200 hover:bg-[#f4eee4] hover:text-[#1f2937] dark:border-white/10 dark:bg-[#223038] dark:text-gray-200 dark:hover:bg-[#293841] dark:hover:text-white",
    "Ver artículo completo"
  );

  linkElement.href = articlePath;
  return linkElement;
}

function renderArticle(article) {
  const articleTitle = sanitizeText(article.title);
  const articleExcerpt = sanitizeText(article.description || article.excerpt || "");
  const articlePath = sanitizeInternalUrl(article.publicPath, "/");
  const articleImage = sanitizeImageUrl(article.image);
  const shell = createShell();
  const contentElement = createElement("div", "flex flex-col gap-5 px-6 py-6 sm:px-8 sm:py-7");
  const headingWrapElement = createElement("div", "flex flex-col gap-3 text-center");
  const headingElement = createElement(
    "h1",
    "text-balance font-serif text-[1.6rem] font-semibold leading-[1.02] tracking-tight text-[#1c2731] dark:text-white sm:text-[1.9rem]",
    articleTitle
  );
  const actionsElement = createElement("div", "flex flex-col gap-3");
  const shareButtonElement = createShareButton();
  const articleLinkElement = createArticleLink(articlePath);

  headingWrapElement.append(headingElement);
  actionsElement.append(shareButtonElement, articleLinkElement);
  contentElement.append(headingWrapElement, actionsElement);

  if (articleExcerpt) {
    const excerptElement = createElement(
      "p",
      "mx-auto max-w-[34ch] text-pretty text-[0.96rem] leading-6 text-[#5b6470] dark:text-gray-300 sm:text-[0.98rem]",
      articleExcerpt
    );
    contentElement.append(excerptElement);
  }

  if (articleImage) {
    shell.articleElement.append(createImageBlock(articleImage, articleTitle));
  }

  shell.articleElement.append(contentElement);
  renderIntoRoot(shell.sectionElement);

  document.title = `Compartir: ${articleTitle} - La Otra Pucela`;

  const descriptionElement = document.querySelector('meta[name="description"]');
  if (descriptionElement) {
    descriptionElement.setAttribute("content", articleExcerpt || "Comparte este artículo de La Otra Pucela.");
  }

  shareButtonElement.addEventListener("click", async () => {
    const sharePayload = createSharePayload(article);

    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: sharePayload.title,
            text: sharePayload.title,
            url: sharePayload.url
          });
        } catch (error) {
          if (error?.name === "AbortError") {
            restoreShareButton(shareButtonElement);
            return;
          }

          throw error;
        }

        trackMatomoEvent("share", `${sharePayload.source}_web_share`, sharePayload.eventName);
        return;
      }

      throw new Error("Web Share API not available");
    } catch {
      try {
        await copySharePayload(sharePayload);
        trackMatomoEvent("share", `${sharePayload.source}_clipboard`, sharePayload.eventName);
        setShareButtonFeedback(shareButtonElement, "¡Enlace copiado!", "fa-solid fa-check text-base");

        window.setTimeout(() => {
          restoreShareButton(shareButtonElement);
        }, 2500);
      } catch {
        restoreShareButton(shareButtonElement);
      }
    }
  });
}

async function loadSharePage() {
  const searchParams = new URLSearchParams(window.location.search);
  const rawId = (searchParams.get("id") || "").trim();

  if (!/^\d+$/.test(rawId)) {
    renderError("Usa un enlace con un identificador numérico válido, por ejemplo /compartir/?id=123.");
    return;
  }

  try {
    const response = await fetch("/api/articulos.json", {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Response not ok");
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const article = items.find((item) => String(item?.id) === rawId);

    if (!article?.publicPath || !article?.title) {
      renderError("Ese identificador no corresponde con ningún artículo disponible ahora mismo.");
      return;
    }

    renderArticle(article);
  } catch {
    renderError("No hemos podido cargar el artículo. Prueba de nuevo dentro de un momento.");
  }
}

document.addEventListener("DOMContentLoaded", loadSharePage);
