import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const discourseBaseUrl = "https://foro.aldeapucela.org";
const categoryUrl = `${discourseBaseUrl}/c/9.json`;
const topicRequestConcurrency = 2;
const maxFetchAttempts = 4;
const baseRetryDelayMs = 1200;
const cacheDirectory = path.resolve(process.cwd(), ".cache");
const cacheFilePath = path.join(cacheDirectory, "articulos.json");

function stripHtml(html = "") {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeDiscourseHtml(html = "") {
  if (!html) {
    return "";
  }

  const $ = cheerio.load(html);

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

  $("p").each((_, element) => {
    const paragraph = $(element);
    const cleanText = paragraph.text().replace(/\u00ad/g, "").replace(/\s+/g, " ").trim();
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

function excerptFromText(text = "", maxLength = 220) {
  if (!text) {
    return "";
  }

  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return "";
  }

  const sentences = normalizedText.match(/[^.!?…]+[.!?…]+/g)?.map((sentence) => sentence.trim()) ?? [];

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

  return normalizedText;
}

function normalizeCommentCount(topic) {
  const postsCount = topic.posts_count ?? 0;
  return Math.max(postsCount - 1, 0);
}

function normalizeTag(tag) {
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

function buildAvatarUrl(avatarTemplate, size = 96) {
  if (!avatarTemplate) {
    return null;
  }

  const avatarPath = avatarTemplate.replace("{size}", String(size));

  if (avatarPath.startsWith("http")) {
    return avatarPath;
  }

  return `${discourseBaseUrl}${avatarPath}`;
}

function normalizeAuthor(author = {}) {
  const name = author.name || author.display_username || author.username || "Aldea Pucela";
  const username = author.username || null;
  const avatarUrl = author.avatarUrl || buildAvatarUrl(author.avatar_template);

  return {
    name,
    username,
    avatarUrl,
    profileUrl: username ? `${discourseBaseUrl}/u/${username}` : null
  };
}

function readCache() {
  if (!existsSync(cacheFilePath)) {
    return {
      itemsById: {}
    };
  }

  try {
    const rawCache = readFileSync(cacheFilePath, "utf8");
    const parsedCache = JSON.parse(rawCache);

    return {
      itemsById: parsedCache.itemsById ?? {}
    };
  } catch {
    return {
      itemsById: {}
    };
  }
}

function writeCache(items) {
  mkdirSync(cacheDirectory, { recursive: true });

  const itemsById = Object.fromEntries(
    items.map((item) => {
      const { publicUrl, ...sanitizedItem } = item;

      return [String(item.id), sanitizedItem];
    })
  );

  writeFileSync(
    cacheFilePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        itemsById
      },
      null,
      2
    ) + "\n"
  );
}

async function fetchJson(url) {
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

    await wait(delayMs);
  }

  throw lastError;
}

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function mapWithConcurrency(items, concurrency, mapper) {
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
}

async function fetchTopicDetail(topic) {
  const topicUrl = `${discourseBaseUrl}/t/${topic.slug}/${topic.id}.json`;

  try {
    const topicPayload = await fetchJson(topicUrl);
    const firstPost = topicPayload.post_stream?.posts?.[0];
    const cooked = sanitizeDiscourseHtml(firstPost?.cooked ?? "");
    const plainText = stripHtml(cooked);

    return {
      canonicalUrl: `${discourseBaseUrl}/t/${topic.slug}/${topic.id}`,
      html: cooked,
      excerpt: excerptFromText(plainText),
      image: topicPayload.image_url ?? null,
      author: normalizeAuthor(firstPost ?? topicPayload.details?.created_by ?? {}),
      postNumber: firstPost?.post_number ?? 1,
      raw: firstPost?.raw ?? ""
    };
  } catch (error) {
    return {
      canonicalUrl: `${discourseBaseUrl}/t/${topic.slug}/${topic.id}`,
      html: "",
      excerpt: excerptFromText(topic.excerpt ?? ""),
      image: null,
      author: normalizeAuthor(),
      postNumber: 1,
      raw: "",
      fetchError: error.message
    };
  }
}

export default async function articulos() {
  const payload = await fetchJson(categoryUrl);
  const topics = payload.topic_list?.topics ?? [];
  const cache = readCache();

  const items = await mapWithConcurrency(
    topics,
    topicRequestConcurrency,
    async (topic) => {
      const tags = (topic.tags ?? []).map(normalizeTag);
      const updatedAt = topic.last_posted_at ?? topic.bumped_at ?? topic.created_at;
      const cachedItem = cache.itemsById[String(topic.id)];
      const cachedAuthor = normalizeAuthor(cachedItem?.author ?? {});
      const canReuseCachedItem = cachedItem
        && cachedItem.updatedAt === updatedAt
        && cachedItem.contentHtml
        && cachedAuthor.username
        && cachedAuthor.avatarUrl
        && cachedAuthor.name !== "Aldea Pucela";

      if (canReuseCachedItem) {
        const sanitizedCachedHtml = sanitizeDiscourseHtml(cachedItem.contentHtml ?? "");
        const cachedPlainText = stripHtml(sanitizedCachedHtml);
        const normalizedExcerpt = excerptFromText(cachedPlainText);

        return {
          ...cachedItem,
          title: topic.title,
          slug: topic.slug,
          tags,
          featured: Boolean(topic.pinned || topic.pinned_globally),
          replies: normalizeCommentCount(topic),
          views: topic.views ?? 0,
          likeCount: topic.like_count ?? 0,
          createdAt: topic.created_at,
          updatedAt,
          author: cachedAuthor,
          excerpt: normalizedExcerpt,
          description: normalizedExcerpt || excerptFromText(topic.excerpt ?? ""),
          contentHtml: sanitizedCachedHtml,
          image: cachedItem.image ?? topic.image_url ?? null,
          source: {
            categoryUrl,
            topicJsonUrl: `${discourseBaseUrl}/t/${topic.slug}/${topic.id}.json`
          },
          publicPath: `/p/${topic.id}/${topic.slug}/`,
          publicUrl: undefined,
          cacheHit: true,
          fetchError: null
        };
      }

      const detail = await fetchTopicDetail(topic);

      return {
        id: topic.id,
        title: topic.title,
        slug: topic.slug,
        tags,
        featured: Boolean(topic.pinned || topic.pinned_globally),
        replies: normalizeCommentCount(topic),
        views: topic.views ?? 0,
        likeCount: topic.like_count ?? 0,
        createdAt: topic.created_at,
        updatedAt,
        author: detail.author,
        excerpt: detail.excerpt,
        description: detail.excerpt || excerptFromText(topic.excerpt ?? ""),
        contentHtml: detail.html,
        discourseTopicUrl: detail.canonicalUrl,
        publicPath: `/p/${topic.id}/${topic.slug}/`,
        image: detail.image ?? topic.image_url ?? null,
        postNumber: detail.postNumber,
        source: {
          categoryUrl,
          topicJsonUrl: `${discourseBaseUrl}/t/${topic.slug}/${topic.id}.json`
        },
        cacheHit: false,
        fetchError: detail.fetchError ?? null
      };
    }
  );

  items.sort((a, b) => {
    if (a.featured !== b.featured) {
      return a.featured ? -1 : 1;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  writeCache(items);

  const tagsMap = new Map();

  for (const articulo of items) {
    for (const tag of articulo.tags) {
      if (!tagsMap.has(tag.slug)) {
        tagsMap.set(tag.slug, {
          ...tag,
          count: 0
        });
      }

      tagsMap.get(tag.slug).count += 1;
    }
  }

  return {
    discourseBaseUrl,
    categoryUrl,
    generatedAt: new Date().toISOString(),
    items,
    tags: Array.from(tagsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es")
    )
  };
}
