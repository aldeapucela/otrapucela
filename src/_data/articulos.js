import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const discourseBaseUrl = "https://foro.aldeapucela.org";
const categoryUrl = `${discourseBaseUrl}/c/9.json`;
const topicRequestConcurrency = 2;
const authorRequestConcurrency = 2;
const maxFetchAttempts = 4;
const baseRetryDelayMs = 1200;
const cacheDirectory = path.resolve(process.cwd(), ".cache");
const cacheFilePath = path.join(cacheDirectory, "articulos.json");
const authorsCacheFilePath = path.join(cacheDirectory, "autores.json");

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

function excerptFromText(text = "", maxLength = 220) {
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

  return normalizedText;
}

function excerptFromHtml(html = "", maxLength = 220) {
  if (!html) {
    return "";
  }

  const $ = cheerio.load(html);
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

function bodyHtmlFromContent(html = "", excerpt = "") {
  if (!html) {
    return "";
  }

  const $ = cheerio.load(html);
  const normalizedExcerpt = normalizeExcerptText(excerpt).replace(/[.!?…]+$/, "");
  const firstParagraph = $("p").first();

  if (firstParagraph.length) {
    const firstParagraphText = normalizeExcerptText(firstParagraph.text()).replace(/[.!?…]+$/, "");

    if (normalizedExcerpt && firstParagraphText === normalizedExcerpt) {
      firstParagraph.remove();

      const nextElement = $("body").children().first();

      if (nextElement.length && nextElement.is("hr")) {
        nextElement.remove();
      }
    }
  }

  return $.root().html() || "";
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

function readAuthorsCache() {
  if (!existsSync(authorsCacheFilePath)) {
    return {
      itemsByUsername: {}
    };
  }

  try {
    const rawCache = readFileSync(authorsCacheFilePath, "utf8");
    const parsedCache = JSON.parse(rawCache);

    return {
      itemsByUsername: parsedCache.itemsByUsername ?? {}
    };
  } catch {
    return {
      itemsByUsername: {}
    };
  }
}

function writeAuthorsCache(authors) {
  mkdirSync(cacheDirectory, { recursive: true });

  const itemsByUsername = Object.fromEntries(
    authors
      .filter((author) => author?.username)
      .map((author) => [String(author.username), author])
  );

  writeFileSync(
    authorsCacheFilePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        itemsByUsername
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

    return {
      canonicalUrl: `${discourseBaseUrl}/t/${topic.slug}/${topic.id}`,
      html: cooked,
      excerpt: excerptFromHtml(cooked),
      bodyHtml: bodyHtmlFromContent(cooked, excerptFromHtml(cooked)),
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

async function fetchAuthorDetail(author) {
  if (!author?.username) {
    return normalizeAuthor(author);
  }

  const authorUrl = `${discourseBaseUrl}/u/${encodeURIComponent(author.username)}.json`;

  try {
    const payload = await fetchJson(authorUrl);
    const user = payload.user ?? {};
    const userProfile = payload.user_profile ?? {};
    const bio = stripHtml(
      userProfile.bio_cooked
      ?? userProfile.bio_raw
      ?? user.bio_cooked
      ?? user.bio_raw
      ?? user.bio_excerpt
      ?? payload.bio_cooked
      ?? payload.bio_raw
      ?? ""
    ).replace(/\s+/g, " ").trim();

    return normalizeAuthor({
      ...author,
      ...payload,
      ...user,
      bio,
      website: user.website ?? payload.website ?? userProfile.website ?? author.website,
      website_name: payload.website_name ?? author.websiteName,
      website_name: user.website_name ?? payload.website_name ?? author.websiteName,
      location: user.location ?? payload.location ?? userProfile.location ?? author.location,
      avatar_template: user.avatar_template || author.avatar_template,
      avatarUrl: author.avatarUrl || buildAvatarUrl(user.avatar_template)
    });
  } catch {
    return normalizeAuthor(author);
  }
}

export default async function articulos() {
  const payload = await fetchJson(categoryUrl);
  const topics = payload.topic_list?.topics ?? [];
  const cache = readCache();
  const authorsCache = readAuthorsCache();

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
        const normalizedExcerpt = excerptFromHtml(sanitizedCachedHtml);

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
          bodyHtml: bodyHtmlFromContent(sanitizedCachedHtml, normalizedExcerpt),
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
        bodyHtml: bodyHtmlFromContent(detail.html, detail.excerpt),
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
  const articleIdsByAuthor = new Map();

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

    if (articulo.author?.username) {
      if (!articleIdsByAuthor.has(articulo.author.username)) {
        articleIdsByAuthor.set(articulo.author.username, []);
      }

      articleIdsByAuthor.get(articulo.author.username).push(articulo.id);
    }
  }

  const uniqueAuthors = Array.from(articleIdsByAuthor.keys())
    .map((username) => {
      const article = items.find((item) => item.author?.username === username);
      const cachedAuthor = normalizeAuthor(authorsCache.itemsByUsername[username] ?? {});

      return {
        ...normalizeAuthor(article?.author ?? {}),
        bio: cachedAuthor.bio || article?.author?.bio || "",
        articleIds: articleIdsByAuthor.get(username) ?? []
      };
    });

  const authors = await mapWithConcurrency(
    uniqueAuthors,
    authorRequestConcurrency,
    async (author) => {
      const cachedAuthor = normalizeAuthor(authorsCache.itemsByUsername[author.username] ?? {});
      const hasReusableCache = cachedAuthor.username
        && cachedAuthor.name !== "Aldea Pucela"
        && cachedAuthor.avatarUrl
        && (
          Boolean(cachedAuthor.bio)
          || Boolean(cachedAuthor.website)
          || Boolean(cachedAuthor.location)
        );

      const resolvedAuthor = hasReusableCache
        ? {
          ...author,
          ...cachedAuthor,
          bio: cachedAuthor.bio || author.bio || "",
          website: cachedAuthor.website || author.website || null,
          websiteName: cachedAuthor.websiteName || author.websiteName || null,
          location: cachedAuthor.location || author.location || null,
          articleIds: author.articleIds
        }
        : {
          ...(await fetchAuthorDetail(author)),
          articleIds: author.articleIds
        };

      return resolvedAuthor;
    }
  );

  const authorsByUsername = new Map(
    authors.map((author) => [author.username, author])
  );

  for (const articulo of items) {
    if (articulo.author?.username && authorsByUsername.has(articulo.author.username)) {
      articulo.author = {
        ...articulo.author,
        ...authorsByUsername.get(articulo.author.username)
      };
    }
  }

  writeAuthorsCache(authors);

  return {
    discourseBaseUrl,
    categoryUrl,
    generatedAt: new Date().toISOString(),
    items,
    authors: authors.sort((a, b) => a.name.localeCompare(b.name, "es")),
    tags: Array.from(tagsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es")
    )
  };
}
