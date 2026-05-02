import { load } from "cheerio";

const discourseBaseUrl = "https://foro.aldeapucela.org";

function stripHtml(html = "") {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExcerptText(text = "") {
  return text.replace(/\u00ad/g, "").replace(/\s+/g, " ").trim();
}

function ensureExcerptEnding(text = "") {
  if (!text) {
    return "";
  }

  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

function normalizeExcerptComparisonText(text = "") {
  return normalizeExcerptText(text)
    .replace(/[.!?…:;,]+$/g, "")
    .replace(/[“”"'"'«»]/g, "")
    .trim()
    .toLowerCase();
}

function removeExcerptPrefix(paragraphText = "", excerpt = "") {
  const normalizedParagraph = normalizeExcerptText(paragraphText);
  const normalizedExcerpt = normalizeExcerptText(excerpt);

  if (!normalizedParagraph || !normalizedExcerpt) {
    return normalizedParagraph;
  }

  if (normalizedParagraph === normalizedExcerpt) {
    return "";
  }

  if (!normalizedParagraph.startsWith(normalizedExcerpt)) {
    return normalizedParagraph;
  }

  return normalizedParagraph
    .slice(normalizedExcerpt.length)
    .replace(/^[\s.!?…:;,"'“”«»\-–—]+/, "")
    .trim();
}

export function buildAvatarUrl(avatarTemplate, size = 96) {
  if (!avatarTemplate) {
    return null;
  }

  const avatarPath = avatarTemplate.replace("{size}", String(size));

  if (avatarPath.startsWith("http")) {
    return avatarPath;
  }

  return `${discourseBaseUrl}${avatarPath}`;
}

export function normalizeAuthor(author = {}) {
  const name = author.name || author.display_username || author.username || "Aldea Pucela";
  const username = author.username || null;
  const avatarUrl = author.avatarUrl || buildAvatarUrl(author.avatar_template);
  const publicPath = username ? `/autor/${encodeURIComponent(username)}/` : null;
  const website = author.website || null;
  const websiteName = author.website_name || null;
  const location = author.location || null;

  return {
    name,
    username,
    avatarUrl,
    bio: author.bio ?? author.bio_excerpt ?? "",
    website,
    websiteName,
    location,
    publicPath,
    profileUrl: username ? `${discourseBaseUrl}/u/${username}` : null
  };
}

export function normalizeTag(tag) {
  if (typeof tag === "string") {
    return {
      name: tag,
      slug: tag
    };
  }

  return {
    id: tag?.id ?? null,
    name: tag?.name ?? tag?.slug ?? "",
    slug: tag?.slug ?? tag?.name ?? ""
  };
}

export function normalizeDiscourseImageUrl(imageUrl = "") {
  if (!imageUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(imageUrl);
    parsedUrl.pathname = parsedUrl.pathname
      .replace(/\/optimized\/\dX\//, "/original/1X/")
      .replace(/_(\d+)_\d+x\d+(?=\.[^.]+$)/, "");
    parsedUrl.search = "";
    parsedUrl.hash = "";
    return parsedUrl.toString();
  } catch {
    return imageUrl;
  }
}

export function normalizeImageSourcesInHtml(html = "") {
  if (!html) {
    return "";
  }

  const $ = load(html);

  $("img").each((_, element) => {
    const imageElement = $(element);
    const normalizedSource = normalizeDiscourseImageUrl(imageElement.attr("src") || "");

    if (normalizedSource) {
      imageElement.attr("src", normalizedSource);
    }
  });

  return $.root().html() || "";
}

export function excerptFromText(text = "", maxLength = 220) {
  if (!text) {
    return "";
  }

  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return "";
  }

  const sentences = [];
  let sentenceStart = 0;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];

    if (!".!?…".includes(character)) {
      continue;
    }

    const previousCharacter = normalizedText[index - 1] ?? "";
    const nextCharacter = normalizedText[index + 1] ?? "";
    const isNumericSeparator = /\d/.test(previousCharacter) && /\d/.test(nextCharacter);

    if (isNumericSeparator) {
      continue;
    }

    const sentence = normalizedText.slice(sentenceStart, index + 1).trim();

    if (sentence) {
      sentences.push(sentence);
    }

    sentenceStart = index + 1;
  }

  if (sentenceStart < normalizedText.length) {
    const trailingSentence = normalizedText.slice(sentenceStart).trim();

    if (trailingSentence) {
      sentences.push(trailingSentence);
    }
  }

  if (sentences.length) {
    let excerpt = "";

    for (const sentence of sentences) {
      const nextExcerpt = excerpt ? `${excerpt} ${sentence}` : sentence;

      if (nextExcerpt.length > maxLength && excerpt) {
        break;
      }

      excerpt = nextExcerpt;

      if (excerpt.length >= maxLength) {
        break;
      }
    }

    return excerpt || sentences[0];
  }

  return normalizedText.slice(0, maxLength);
}

export function excerptFromHtml(html = "", maxLength = 220) {
  if (!html) {
    return "";
  }

  const $ = load(html);
  const firstParagraph = $("p").toArray().find((element) => {
    const text = normalizeExcerptText($(element).text());

    return text && !/^compartir en redes y grupos$/i.test(text);
  });

  if (firstParagraph) {
    const paragraphText = normalizeExcerptText($(firstParagraph).text());

    if (paragraphText.length <= maxLength) {
      return ensureExcerptEnding(paragraphText);
    }

    return ensureExcerptEnding(excerptFromText(paragraphText, maxLength));
  }

  return ensureExcerptEnding(excerptFromText(stripHtml(html), maxLength));
}

export function bodyHtmlFromContent(html = "", excerpt = "") {
  if (!html) {
    return "";
  }

  const $ = load(html);
  const normalizedExcerpt = normalizeExcerptComparisonText(excerpt);
  const firstParagraph = $("p").first();

  if (firstParagraph.length) {
    const rawFirstParagraphText = firstParagraph.text();
    const firstParagraphText = normalizeExcerptComparisonText(rawFirstParagraphText);

    const excerptMatchesFirstParagraph = normalizedExcerpt
      && firstParagraphText
      && (
        firstParagraphText === normalizedExcerpt
        || firstParagraphText.startsWith(normalizedExcerpt)
      );

    if (excerptMatchesFirstParagraph) {
      const remainingParagraphText = removeExcerptPrefix(rawFirstParagraphText, excerpt);

      if (remainingParagraphText) {
        firstParagraph.text(remainingParagraphText);
      } else {
        firstParagraph.remove();
      }

      const nextElement = $("body").children().first();

      if (nextElement.length && nextElement.is("hr")) {
        nextElement.remove();
      }
    }
  }

  return $.root().html() || "";
}

export function extractPrimaryMediaFromHtml(html = "") {
  if (!html) {
    return {
      mediaUrl: null,
      bodyHtml: ""
    };
  }

  const $ = load(html);
  const firstIframe = $("iframe").first();

  if (!firstIframe.length) {
    return {
      mediaUrl: null,
      bodyHtml: $.root().html() || ""
    };
  }

  const mediaUrl = firstIframe.attr("src")?.trim() || null;
  const iframeParent = firstIframe.parent();
  const parentContainsOnlyIframe = iframeParent.length
    && iframeParent.is("p, div, figure")
    && iframeParent.children().length === 1
    && iframeParent.find("iframe").length === 1
    && !iframeParent.text().trim();

  if (parentContainsOnlyIframe) {
    iframeParent.remove();
  } else {
    firstIframe.remove();
  }

  $("p").each((_, element) => {
    const paragraph = $(element);

    if (!paragraph.text().trim() && paragraph.find("img, a, strong, em, iframe").length === 0) {
      paragraph.remove();
    }
  });

  return {
    mediaUrl,
    bodyHtml: $.root().html() || ""
  };
}

export function sanitizeDiscourseHtml(html = "") {
  if (!html) {
    return "";
  }

  const $ = load(html);

  $("a.anchor").remove();
  $(".meta").remove();
  $(".filename").remove();
  $(".informations").remove();

  $(".lightbox-wrapper").each((_, element) => {
    $(element).replaceWith($(element).html() || "");
  });

  $(".lightbox").each((_, element) => {
    const imageElement = $(element).find("img").first();

    if (imageElement.length) {
      imageElement.attr("loading", "lazy");
      imageElement.removeAttr("width");
      imageElement.removeAttr("height");
      $(element).replaceWith(imageElement);
      return;
    }

    $(element).replaceWith($(element).html() || "");
  });

  $(".d-wrap").each((_, element) => {
    $(element).replaceWith($(element).html() || "");
  });

  $("aside.onebox").each((_, element) => {
    const onebox = $(element);
    const sourceUrl = onebox.attr("data-onebox-src")
      || onebox.find("h3 a").attr("href")
      || onebox.find("header.source a").attr("href")
      || "";
    const title = onebox.find("h3 a").first().text().replace(/\s+/g, " ").trim()
      || onebox.find("header.source a").first().text().replace(/\s+/g, " ").trim()
      || sourceUrl;
    const description = onebox.find(".onebox-body p").first().text().replace(/\s+/g, " ").trim();
    const hostname = (() => {
      try {
        return sourceUrl ? new URL(sourceUrl).hostname : "";
      } catch {
        return "";
      }
    })();
    const imageElement = onebox.find("img.thumbnail").first();

    const wrapper = $("<blockquote></blockquote>");

    if (imageElement.length && imageElement.attr("src")) {
      const imageClone = imageElement.clone();
      imageClone.attr("loading", "lazy");
      imageClone.removeAttr("width");
      imageClone.removeAttr("height");
      imageClone.removeAttr("srcset");
      wrapper.append(imageClone);
    }

    if (title && sourceUrl) {
      wrapper.append(
        `<p><strong><a href="${sourceUrl}" target="_blank" rel="noreferrer">${title}</a></strong></p>`
      );
    } else if (sourceUrl) {
      wrapper.append(
        `<p><strong><a href="${sourceUrl}" target="_blank" rel="noreferrer">${sourceUrl}</a></strong></p>`
      );
    }

    if (description) {
      wrapper.append(`<p>${description}</p>`);
    }

    if (hostname && sourceUrl) {
      wrapper.append(
        `<p><a href="${sourceUrl}" target="_blank" rel="noreferrer">${hostname}</a></p>`
      );
    }

    onebox.replaceWith(wrapper);
  });

  $("div[align='center']").each((_, element) => {
    $(element).replaceWith($(element).html() || "");
  });

  $("br").each((_, element) => {
    const previousNode = $(element).prev();
    const nextNode = $(element).next();

    if (!previousNode.length || !nextNode.length) {
      $(element).remove();
    }
  });

  $("img").each((_, element) => {
    $(element).attr("loading", "lazy");
    $(element).removeAttr("width");
    $(element).removeAttr("height");
    $(element).removeAttr("srcset");
    $(element).removeAttr("data-base62-sha1");
    $(element).removeAttr("data-dominant-color");
  });

  $("iframe").each((_, element) => {
    $(element).removeAttr("width");
    $(element).removeAttr("height");
  });

  $("p").each((_, element) => {
    const paragraph = $(element);
    const cleanText = normalizeExcerptText(paragraph.text());
    const isDimensionCaption = /^\d+\s*[×x]\s*\d+(\s+\d+([.,]\d+)?\s*(KB|MB|GB))?$/i.test(cleanText)
      || /^\d+\s*[×x]\s*\d+\s+\d+([.,]\d+)?\s*(KB|MB|GB)$/i.test(cleanText);

    if ((!cleanText || isDimensionCaption) && paragraph.find("img, a, strong, em, iframe").length === 0) {
      paragraph.remove();
    }
  });

  $("figcaption").remove();
  $("span.informations").remove();

  return $.root().html() || "";
}

export function fetchJsonFactory(maxFetchAttempts = 4, baseRetryDelayMs = 1200) {
  return async function fetchJson(url) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxFetchAttempts; attempt += 1) {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json"
        }
      });

      if (response.ok) {
        return response.json();
      }

      const isRetryable = response.status === 429 || response.status >= 500;
      lastError = new Error(`Discourse respondio con ${response.status} en ${url}`);

      if (!isRetryable || attempt === maxFetchAttempts) {
        throw lastError;
      }

      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterMs = Number(retryAfterHeader) * 1000;
      const delayMs = Number.isFinite(retryAfterMs) && retryAfterMs > 0
        ? retryAfterMs
        : baseRetryDelayMs * attempt;

      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }

    throw lastError;
  };
}

export async function fetchAllCategoryTopics(categoryUrl, fetchJson, options = {}) {
  const {
    logger = console,
    label = "discourse"
  } = options;
  const topicsById = new Map();
  const visitedPageUrls = new Set();
  let nextPageUrl = categoryUrl;
  let pageCount = 0;

  while (nextPageUrl && !visitedPageUrls.has(nextPageUrl)) {
    visitedPageUrls.add(nextPageUrl);

    let payload;

    try {
      payload = await fetchJson(nextPageUrl);
    } catch (error) {
      if (pageCount > 0) {
        logger.warn(
          `[${label}] No se pudo cargar la pagina ${pageCount + 1} de la categoria; se conservan ${topicsById.size} topics ya recuperados.`,
          error
        );
      }

      throw error;
    }

    pageCount += 1;

    const topics = payload?.topic_list?.topics ?? [];

    for (const topic of topics) {
      if (topic?.id != null && !topicsById.has(String(topic.id))) {
        topicsById.set(String(topic.id), topic);
      }
    }

    const moreTopicsPath = payload?.topic_list?.more_topics_url;

    nextPageUrl = moreTopicsPath
      ? new URL(moreTopicsPath, discourseBaseUrl).toString()
      : null;
  }

  if (pageCount > 1) {
    logger.info(
      `[${label}] Categoria paginada: ${pageCount} paginas, ${topicsById.size} topics recuperados.`
    );
  }

  return Array.from(topicsById.values());
}

export function mapWithConcurrencyFactory() {
  return async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let currentIndex = 0;

    async function worker() {
      while (currentIndex < items.length) {
        const itemIndex = currentIndex;
        currentIndex += 1;
        results[itemIndex] = await mapper(items[itemIndex], itemIndex);
      }
    }

    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker()
    );

    await Promise.all(workers);

    return results;
  };
}

export function detectContentType({ raw = "", html = "" } = {}) {
  const source = `${raw}\n${html}`.toLowerCase();
  if (/peertube|iframe|\/videos?\//i.test(source)) {
    return "video";
  }

  return "image";
}
