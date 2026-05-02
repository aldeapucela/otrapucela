import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  bodyHtmlFromContent as sharedBodyHtmlFromContent,
  detectContentType,
  excerptFromHtml as sharedExcerptFromHtml,
  excerptFromText as sharedExcerptFromText,
  extractPrimaryMediaFromHtml,
  fetchAllCategoryTopics,
  fetchJsonFactory,
  mapWithConcurrencyFactory,
  normalizeDiscourseImageUrl,
  normalizeImageSourcesInHtml,
  sanitizeDiscourseHtml as sharedSanitizeDiscourseHtml
} from "./discourse-utils.js";
import vineta from "./vineta.js";
import vinetaIds from "./vinetaIds.js";

const discourseBaseUrl = "https://foro.aldeapucela.org";
const categoryUrl = `${discourseBaseUrl}/c/9.json`;
const topicRequestConcurrency = 2;
const authorRequestConcurrency = 2;
const audioRequestConcurrency = 4;
const maxFetchAttempts = 4;
const baseRetryDelayMs = 1200;
const cacheDirectory = path.resolve(process.cwd(), ".cache");
const cacheFilePath = path.join(cacheDirectory, "articulos.json");
const authorsCacheFilePath = path.join(cacheDirectory, "autores.json");
const audioManifestCacheFilePath = path.join(cacheDirectory, "audio-manifest.json");
const remoteAudioBaseUrl = "https://media.aldeapucela.org/public.php/dav/files/qGB2wj3AjGZSb4E";
const defaultAudioManifestUrl = `${remoteAudioBaseUrl}/audio-manifest.json`;
const audioManifestUrl = process.env.AUDIO_MANIFEST_URL?.trim() || defaultAudioManifestUrl;
const audioManifestTtlMs = Number.parseInt(process.env.AUDIO_MANIFEST_TTL_MS ?? "", 10) || (10 * 60 * 1000);
const fetchJson = fetchJsonFactory(maxFetchAttempts, baseRetryDelayMs);
const mapWithConcurrency = mapWithConcurrencyFactory();
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

function buildArticleAudio(id, isAvailable = true) {
  const articleId = String(id ?? "").trim();
  const audioIsAvailable = typeof isAvailable === "object"
    ? isAvailable?.isAvailable === true
    : isAvailable === true;

  if (!articleId || !audioIsAvailable) {
    return null;
  }
  const audioUrl = `${remoteAudioBaseUrl}/${encodeURIComponent(articleId)}.mp3`;
  const audioSizeBytes = Number.isFinite(isAvailable?.sizeBytes) ? isAvailable.sizeBytes : null;
  const audioMimeType = typeof isAvailable?.mimeType === "string" && isAvailable.mimeType.trim()
    ? isAvailable.mimeType.trim()
    : "audio/mpeg";

  return {
    sources: [
      {
        src: audioUrl,
        type: audioMimeType
      }
    ],
    downloadUrl: audioUrl,
    sizeBytes: audioSizeBytes,
    mimeType: audioMimeType,
    duration: typeof isAvailable?.duration === "string" ? isAvailable.duration : null
  };
}

function buildArticleAudioFromCachedItem(item = {}) {
  if (!item?.audio?.sources?.length) {
    return buildArticleAudio(item?.id);
  }

  return {
    ...item.audio,
    sources: item.audio.sources.map((source) => ({
      ...source
    }))
  };
}

async function remoteAudioExists(id) {
  const articleId = String(id ?? "").trim();

  if (!articleId) {
    return false;
  }

  const audioUrl = `${remoteAudioBaseUrl}/${encodeURIComponent(articleId)}.mp3`;

  try {
    const response = await fetch(audioUrl, {
      method: "HEAD"
    });

    if (!response.ok) {
      return {
        isAvailable: false
      };
    }

    const contentLengthHeader = response.headers.get("content-length");
    const parsedSize = Number.parseInt(contentLengthHeader ?? "", 10);
    const contentType = response.headers.get("content-type") || "audio/mpeg";

    return {
      isAvailable: true,
      sizeBytes: Number.isFinite(parsedSize) ? parsedSize : null,
      mimeType: contentType.split(";")[0]?.trim() || "audio/mpeg"
    };
  } catch {
    return {
      isAvailable: false
    };
  }
}

function normalizeAudioManifestEntry(entry = {}) {
  const id = String(
    entry.id
    ?? entry.articleId
    ?? entry.topicId
    ?? entry.slug
    ?? ""
  ).trim();

  if (!id) {
    return null;
  }

  const hasExplicitAvailability = typeof entry.isAvailable === "boolean";
  const src = typeof entry.src === "string" && entry.src.trim()
    ? entry.src.trim()
    : `${remoteAudioBaseUrl}/${encodeURIComponent(id)}.mp3`;
  const mimeType = typeof entry.mimeType === "string" && entry.mimeType.trim()
    ? entry.mimeType.trim()
    : "audio/mpeg";
  const duration = typeof entry.duration === "string" && entry.duration.trim()
    ? entry.duration.trim()
    : null;
  const rawSize = Number.parseInt(entry.sizeBytes ?? entry.size ?? "", 10);
  const sizeBytes = Number.isFinite(rawSize) ? rawSize : null;

  return {
    id,
    isAvailable: hasExplicitAvailability
      ? entry.isAvailable
      : Boolean(src),
    src,
    downloadUrl: typeof entry.downloadUrl === "string" && entry.downloadUrl.trim()
      ? entry.downloadUrl.trim()
      : src,
    mimeType,
    duration,
    sizeBytes
  };
}

function normalizeAudioManifest(payload = {}) {
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.audios)
        ? payload.audios
        : Object.entries(payload.itemsById ?? {}).map(([id, entry]) => ({
          id,
          ...entry
        }));

  const items = rawItems
    .map(normalizeAudioManifestEntry)
    .filter(Boolean);

  return {
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : null,
    itemsById: Object.fromEntries(items.map((entry) => [entry.id, entry]))
  };
}

function readAudioManifestCache() {
  if (!existsSync(audioManifestCacheFilePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(audioManifestCacheFilePath, "utf8"));
  } catch {
    return null;
  }
}

function writeAudioManifestCache(manifest) {
  mkdirSync(cacheDirectory, { recursive: true });

  writeFileSync(
    audioManifestCacheFilePath,
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        manifest
      },
      null,
      2
    ) + "\n"
  );
}

function readFreshAudioManifestFromCache() {
  const cachedPayload = readAudioManifestCache();
  const fetchedAtMs = new Date(cachedPayload?.fetchedAt ?? "").getTime();

  if (!cachedPayload?.manifest || !Number.isFinite(fetchedAtMs)) {
    return null;
  }

  if ((Date.now() - fetchedAtMs) > audioManifestTtlMs) {
    return null;
  }

  return normalizeAudioManifest(cachedPayload.manifest);
}

async function fetchAudioManifest() {
  if (!audioManifestUrl) {
    return null;
  }

  const freshCachedManifest = readFreshAudioManifestFromCache();

  if (freshCachedManifest) {
    return freshCachedManifest;
  }

  try {
    const manifestPayload = await fetchJson(audioManifestUrl);
    writeAudioManifestCache(manifestPayload);
    return normalizeAudioManifest(manifestPayload);
  } catch (error) {
    const cachedPayload = readAudioManifestCache();

    if (cachedPayload?.manifest) {
      console.warn("[articulos] No se pudo actualizar el manifiesto de audio; usando cache local.", error);
      return normalizeAudioManifest(cachedPayload.manifest);
    }

    console.warn("[articulos] No se pudo cargar el manifiesto de audio; se usa comprobacion HEAD por articulo.", error);
    return null;
  }
}

function buildArticleAudioFromManifestEntry(entry) {
  if (!entry?.isAvailable) {
    return null;
  }

  return {
    sources: [
      {
        src: entry.src,
        type: entry.mimeType || "audio/mpeg"
      }
    ],
    downloadUrl: entry.downloadUrl || entry.src,
    sizeBytes: Number.isFinite(entry.sizeBytes) ? entry.sizeBytes : null,
    mimeType: entry.mimeType || "audio/mpeg",
    duration: entry.duration || null
  };
}

async function resolveAudioAvailability(items) {
  const manifest = await fetchAudioManifest();

  if (manifest) {
    return new Map(
      items.map((item) => {
        const manifestEntry = manifest.itemsById[String(item.id)];
        return [String(item.id), manifestEntry ? buildArticleAudioFromManifestEntry(manifestEntry) : null];
      })
    );
  }

  const audioAvailabilityEntries = await mapWithConcurrency(
    items,
    audioRequestConcurrency,
    async (item) => [String(item.id), await remoteAudioExists(item.id)]
  );

  return new Map(
    audioAvailabilityEntries.map(([id, availability]) => [id, buildArticleAudio(id, availability)])
  );
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

function buildTagsFromItems(items = []) {
  const tagsMap = new Map();

  for (const articulo of items) {
    for (const tag of articulo.tags ?? []) {
      if (!tagsMap.has(tag.slug)) {
        tagsMap.set(tag.slug, {
          ...tag,
          count: 0
        });
      }

      tagsMap.get(tag.slug).count += 1;
    }
  }

  return Array.from(tagsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );
}

function buildFallbackDataFromCache(cache, authorsCache, error, vinetaIdSet = new Set()) {
  const items = Object.values(cache.itemsById ?? {})
    .map((item) => {
      const cachedAuthor = item.author?.username
        ? normalizeAuthor(authorsCache.itemsByUsername[item.author.username] ?? {})
        : {};

      return {
        ...item,
        tags: (item.tags ?? []).map(normalizeTag),
        replies: Number(item.replies ?? 0),
        views: Number(item.views ?? 0),
        likeCount: Number(item.likeCount ?? 0),
        contentType: item.contentType ?? "image",
        isVideo: item.isVideo === true,
        mediaUrl: item.mediaUrl ?? null,
        previewImage: item.previewImage ?? null,
        audio: vinetaIdSet.has(Number(item.id)) ? null : buildArticleAudioFromCachedItem(item),
        author: normalizeAuthor({
          ...item.author,
          ...cachedAuthor
        }),
        fetchError: item.fetchError ?? error.message
      };
    })
    .sort((a, b) => {
      if (a.featured !== b.featured) {
        return a.featured ? -1 : 1;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const authors = Object.values(authorsCache.itemsByUsername ?? {})
    .map((author) => normalizeAuthor(author))
    .filter((author) => author.username)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    discourseBaseUrl,
    categoryUrl,
    generatedAt: new Date().toISOString(),
    items,
    authors,
    tags: buildTagsFromItems(items)
  };
}

async function fetchTopicDetail(topic) {
  const topicUrl = `${discourseBaseUrl}/t/${topic.slug}/${topic.id}.json`;

  try {
    const topicPayload = await fetchJson(topicUrl);
    const firstPost = topicPayload.post_stream?.posts?.[0];
    const cooked = sharedSanitizeDiscourseHtml(firstPost?.cooked ?? "");
    const cookedWithOriginalImages = normalizeImageSourcesInHtml(cooked);
    const contentType = detectContentType({
      raw: firstPost?.raw ?? "",
      html: cookedWithOriginalImages
    });
    const primaryMedia = contentType === "video"
      ? extractPrimaryMediaFromHtml(cookedWithOriginalImages)
      : { mediaUrl: null, bodyHtml: cookedWithOriginalImages };
    const excerpt = sharedExcerptFromHtml(cookedWithOriginalImages);

    return {
      canonicalUrl: `${discourseBaseUrl}/t/${topic.slug}/${topic.id}`,
      html: cookedWithOriginalImages,
      excerpt,
      bodyHtml: sharedBodyHtmlFromContent(primaryMedia.bodyHtml, excerpt),
      image: normalizeDiscourseImageUrl(topicPayload.image_url ?? null),
      previewImage: null,
      mediaUrl: primaryMedia.mediaUrl,
      author: normalizeAuthor(firstPost ?? topicPayload.details?.created_by ?? {}),
      postNumber: firstPost?.post_number ?? 1,
      raw: firstPost?.raw ?? "",
      contentType,
      isVideo: contentType === "video"
    };
  } catch (error) {
    return {
      canonicalUrl: `${discourseBaseUrl}/t/${topic.slug}/${topic.id}`,
      html: "",
      excerpt: sharedExcerptFromText(topic.excerpt ?? ""),
      bodyHtml: "",
      image: null,
      previewImage: null,
      mediaUrl: null,
      author: normalizeAuthor(),
      postNumber: 1,
      raw: "",
      fetchError: error.message,
      contentType: "image",
      isVideo: false
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
  const cache = readCache();
  const authorsCache = readAuthorsCache();
  const vinetaIdSet = new Set(await vinetaIds());
  const vinetaPreviewById = new Map(
    (await vineta()).items.map((item) => [String(item.id), item.previewImage ?? item.image ?? null])
  );
  let topics;

  try {
    topics = await fetchAllCategoryTopics(categoryUrl, fetchJson, {
      label: "articulos"
    });
  } catch (error) {
    const cachedItems = Object.values(cache.itemsById ?? {});

    if (cachedItems.length > 0) {
      console.warn(
        `[articulos] No se pudo actualizar Discourse; usando cache local (${cachedItems.length} articulos).`,
        error
      );
      return buildFallbackDataFromCache(cache, authorsCache, error, vinetaIdSet);
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
      const cachedAuthor = normalizeAuthor(cachedItem?.author ?? {});
      const canReuseCachedItem = cachedItem
        && cachedItem.updatedAt === updatedAt
        && cachedItem.contentHtml
        && cachedAuthor.username
        && cachedAuthor.avatarUrl
        && cachedAuthor.name !== "Aldea Pucela";

      if (canReuseCachedItem) {
        const sanitizedCachedHtml = sharedSanitizeDiscourseHtml(cachedItem.contentHtml ?? "");
        const cachedHtmlWithOriginalImages = normalizeImageSourcesInHtml(sanitizedCachedHtml);
        const contentType = detectContentType({
          raw: cachedItem.raw ?? "",
          html: cachedHtmlWithOriginalImages
        });
        const primaryMedia = contentType === "video"
          ? extractPrimaryMediaFromHtml(cachedHtmlWithOriginalImages)
          : { mediaUrl: cachedItem.mediaUrl ?? null, bodyHtml: cachedHtmlWithOriginalImages };
        const normalizedExcerpt = sharedExcerptFromHtml(cachedHtmlWithOriginalImages);

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
          description: normalizedExcerpt || sharedExcerptFromText(topic.excerpt ?? ""),
          bodyHtml: sharedBodyHtmlFromContent(primaryMedia.bodyHtml, normalizedExcerpt),
          contentHtml: cachedHtmlWithOriginalImages,
          image: normalizeDiscourseImageUrl(cachedItem.image ?? topic.image_url ?? null),
          previewImage: cachedItem.previewImage ?? vinetaPreviewById.get(String(topic.id)) ?? null,
          mediaUrl: primaryMedia.mediaUrl,
          contentType,
          isVideo: contentType === "video",
          audio: buildArticleAudio(topic.id),
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
        description: detail.excerpt || sharedExcerptFromText(topic.excerpt ?? ""),
        bodyHtml: detail.bodyHtml,
        contentHtml: normalizeImageSourcesInHtml(detail.html),
        discourseTopicUrl: detail.canonicalUrl,
        publicPath: `/p/${topic.id}/${topic.slug}/`,
        image: normalizeDiscourseImageUrl(detail.image ?? topic.image_url ?? null),
        previewImage: detail.previewImage ?? vinetaPreviewById.get(String(topic.id)) ?? null,
        mediaUrl: detail.mediaUrl ?? null,
        contentType: detail.contentType ?? "image",
        isVideo: detail.isVideo === true,
        audio: buildArticleAudio(topic.id),
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

  const audioAvailabilityMap = await resolveAudioAvailability(items);

  items.forEach((item) => {
    item.audio = audioAvailabilityMap.get(String(item.id)) ?? null;
    if (vinetaIdSet.has(Number(item.id))) {
      item.audio = null;
    }
  });

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
