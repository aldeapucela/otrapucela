import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import {
  bodyHtmlFromContent,
  detectContentType,
  excerptFromHtml,
  excerptFromText,
  fetchAllCategoryTopics,
  fetchJsonFactory,
  mapWithConcurrencyFactory,
  normalizeAuthor,
  normalizeDiscourseImageUrl,
  normalizeImageSourcesInHtml,
  normalizeTag,
  sanitizeDiscourseHtml
} from "./discourse-utils.js";

const discourseBaseUrl = "https://foro.aldeapucela.org";
const categoryUrl = "https://foro.aldeapucela.org/c/otra-pucela/la-vineta/11.json";
const topicRequestConcurrency = 2;
const maxFetchAttempts = 4;
const baseRetryDelayMs = 1200;
const cacheDirectory = path.resolve(process.cwd(), ".cache");
const cacheFilePath = path.join(cacheDirectory, "vineta.json");
const fetchJson = fetchJsonFactory(maxFetchAttempts, baseRetryDelayMs);
const mapWithConcurrency = mapWithConcurrencyFactory();

function normalizePeerTubeWatchUrl(embedUrl = "") {
  if (!embedUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(embedUrl);
    parsedUrl.pathname = parsedUrl.pathname.replace("/embed/", "/watch/");
    parsedUrl.search = "";
    parsedUrl.hash = "";
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function detectDirectVideoUrl(mediaUrl = "") {
  if (!mediaUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(mediaUrl);
    if (/\.(mp4|m4v|webm|mov)(\?|#|$)/i.test(parsedUrl.pathname)) {
      return parsedUrl.toString();
    }
  } catch {
    if (/\.(mp4|m4v|webm|mov)(\?|#|$)/i.test(mediaUrl)) {
      return mediaUrl;
    }
  }

  return null;
}

async function fetchPeerTubePreviewImage(embedUrl = "") {
  const watchUrl = normalizePeerTubeWatchUrl(embedUrl);

  if (!watchUrl) {
    return null;
  }

  const oembedUrl = new URL("/services/oembed", new URL(watchUrl));
  oembedUrl.searchParams.set("url", watchUrl);
  oembedUrl.searchParams.set("format", "json");

  try {
    const response = await fetch(oembedUrl.toString(), {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return typeof payload.thumbnail_url === "string" && payload.thumbnail_url.trim()
      ? payload.thumbnail_url.trim()
      : null;
  } catch {
    return null;
  }
}

function readCache() {
  if (!existsSync(cacheFilePath)) {
    return { itemsById: {} };
  }

  try {
    const rawCache = readFileSync(cacheFilePath, "utf8");
    const parsedCache = JSON.parse(rawCache);

    return {
      itemsById: parsedCache.itemsById ?? {}
    };
  } catch {
    return { itemsById: {} };
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

function normalizeCommentCount(topic) {
  const postsCount = topic.posts_count ?? 0;
  return Math.max(postsCount - 1, 0);
}

async function fetchTopicDetail(topic) {
  const topicUrl = `${discourseBaseUrl}/t/${topic.slug}/${topic.id}.json`;

  try {
    const topicPayload = await fetchJson(topicUrl);
    const firstPost = topicPayload.post_stream?.posts?.[0];
    const cooked = sanitizeDiscourseHtml(firstPost?.cooked ?? "");
    const cookedWithOriginalImages = normalizeImageSourcesInHtml(cooked);
    const iframeSrc = load(cookedWithOriginalImages)("iframe").first().attr("src") || "";
    const previewImage = await fetchPeerTubePreviewImage(iframeSrc);
    const originalImage = normalizeDiscourseImageUrl(topicPayload.image_url ?? null);

    return {
      canonicalUrl: `${discourseBaseUrl}/t/${topic.slug}/${topic.id}`,
      html: cookedWithOriginalImages,
      excerpt: excerptFromHtml(cookedWithOriginalImages),
      bodyHtml: bodyHtmlFromContent(cookedWithOriginalImages, excerptFromHtml(cookedWithOriginalImages)),
      image: originalImage,
      previewImage,
      mediaUrl: iframeSrc || null,
      directVideoUrl: detectDirectVideoUrl(iframeSrc),
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
      previewImage: null,
      mediaUrl: null,
      directVideoUrl: null,
      author: normalizeAuthor(),
      postNumber: 1,
      raw: "",
      fetchError: error.message
    };
  }
}

function normalizeTopicItem(topic, detail, updatedAt, tags) {
  const contentType = detectContentType({
    raw: detail.raw,
    html: detail.html
  });

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
    previewImage: detail.previewImage ?? null,
    mediaUrl: detail.mediaUrl ?? null,
    directVideoUrl: detail.directVideoUrl ?? null,
    postNumber: detail.postNumber,
    source: {
      categoryUrl,
      topicJsonUrl: `${discourseBaseUrl}/t/${topic.slug}/${topic.id}.json`
    },
    cacheHit: false,
    fetchError: detail.fetchError ?? null,
    contentType,
    isVideo: contentType === "video",
    hasVisual: Boolean(detail.image ?? topic.image_url ?? null) || Boolean(detail.previewImage) || contentType === "video"
  };
}

function buildFallbackDataFromCache(cache, error) {
  const items = Object.values(cache.itemsById ?? {})
    .map((item) => ({
      ...item,
      tags: (item.tags ?? []).map(normalizeTag),
      replies: Number(item.replies ?? 0),
      views: Number(item.views ?? 0),
      likeCount: Number(item.likeCount ?? 0),
      author: normalizeAuthor(item.author ?? {}),
      image: normalizeDiscourseImageUrl(item.image ?? null),
      fetchError: item.fetchError ?? error.message
    }))
    .sort((a, b) => {
      if (a.featured !== b.featured) {
        return a.featured ? -1 : 1;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return {
    discourseBaseUrl,
    categoryUrl,
    generatedAt: new Date().toISOString(),
    items
  };
}

export default async function vineta() {
  const cache = readCache();
  let topics;

  try {
    topics = await fetchAllCategoryTopics(categoryUrl, fetchJson, {
      label: "vineta"
    });
  } catch (error) {
    const cachedItems = Object.values(cache.itemsById ?? {});

    if (cachedItems.length > 0) {
      console.warn(
        `[vineta] No se pudo actualizar Discourse; usando cache local (${cachedItems.length} items).`,
        error
      );
      return buildFallbackDataFromCache(cache, error);
    }

    throw error;
  }

  const items = await mapWithConcurrency(
    topics,
    topicRequestConcurrency,
    async (topic) => {
      const tags = (topic.tags ?? []).map(normalizeTag);
      const updatedAt = topic.last_posted_at ?? topic.bumped_at ?? topic.created_at;
      const cachedItem = cache.itemsById[String(topic.id)];

      if (cachedItem && cachedItem.updatedAt === updatedAt && cachedItem.contentHtml) {
        const sanitizedCachedHtml = sanitizeDiscourseHtml(cachedItem.contentHtml ?? "");
        const cachedHtmlWithOriginalImages = normalizeImageSourcesInHtml(sanitizedCachedHtml);
        const normalizedExcerpt = excerptFromHtml(cachedHtmlWithOriginalImages);
        const contentType = detectContentType({
          raw: cachedItem.raw ?? "",
          html: cachedHtmlWithOriginalImages
        });

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
          excerpt: normalizedExcerpt,
          description: normalizedExcerpt || excerptFromText(topic.excerpt ?? ""),
          bodyHtml: bodyHtmlFromContent(cachedHtmlWithOriginalImages, normalizedExcerpt),
          contentHtml: cachedHtmlWithOriginalImages,
          image: normalizeDiscourseImageUrl(cachedItem.image ?? topic.image_url ?? null),
          previewImage: cachedItem.previewImage ?? null,
          mediaUrl: cachedItem.mediaUrl ?? null,
          directVideoUrl: cachedItem.directVideoUrl ?? null,
          publicPath: `/p/${topic.id}/${topic.slug}/`,
          source: {
            categoryUrl,
            topicJsonUrl: `${discourseBaseUrl}/t/${topic.slug}/${topic.id}.json`
          },
          cacheHit: true,
          fetchError: null,
          contentType,
          isVideo: contentType === "video",
          hasVisual: Boolean(normalizeDiscourseImageUrl(cachedItem.image ?? topic.image_url ?? null)) || Boolean(cachedItem.previewImage) || contentType === "video"
        };
      }

      const detail = await fetchTopicDetail(topic);
      return normalizeTopicItem(topic, detail, updatedAt, tags);
    }
  );

  items.sort((a, b) => {
    if (a.featured !== b.featured) {
      return a.featured ? -1 : 1;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const visibleItems = items.filter((item) => item.hasVisual);

  writeCache(visibleItems);

  return {
    discourseBaseUrl,
    categoryUrl,
    generatedAt: new Date().toISOString(),
    items: visibleItems
  };
}
