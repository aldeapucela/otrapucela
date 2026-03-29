import { readFileSync } from "node:fs";
import path from "node:path";

export default function eleventyConfig(config) {
  config.addPassthroughCopy({ "src/assets/favicon.ico": "favicon.ico" });
  config.addPassthroughCopy({ "src/assets/favicon.svg": "favicon.svg" });
  config.addPassthroughCopy({ "src/assets/apple-touch-icon.png": "apple-touch-icon.png" });
  config.addPassthroughCopy({ "src/assets/icon-192.png": "assets/icon-192.png" });
  config.addPassthroughCopy({ "src/assets/icon-512.png": "assets/icon-512.png" });
  config.addPassthroughCopy({ "src/assets/logo-wordmark.png": "assets/logo-wordmark.png" });
  config.addPassthroughCopy({ "src/assets/logo-wordmark.dark.png": "assets/logo-wordmark.dark.png" });
  config.addPassthroughCopy({ "src/assets/logo-wordmark.svg": "assets/logo-wordmark.svg" });
  config.addPassthroughCopy({ "src/assets/social-preview.png": "assets/social-preview.png" });
  config.addPassthroughCopy({ "src/assets/podcast-cover.png": "assets/podcast-cover.png" });
  config.addPassthroughCopy({ "src/service-worker.js": "service-worker.js" });
  config.addPassthroughCopy({ "src/assets/js": "assets/js" });


  config.addWatchTarget("./src/assets/styles");

  config.addGlobalData("assetManifest", () => {
    const manifestPath = path.join(process.cwd(), "dist", "assets", "manifest.json");

    try {
      const fileContents = readFileSync(manifestPath, "utf8");
      return JSON.parse(fileContents);
    } catch {
      return {
        "assets/styles/main.css": "/assets/styles/main.css",
        "assets/js/app-constants.js": "/assets/js/app-constants.js",
        "assets/js/app-utils.js": "/assets/js/app-utils.js",
        "assets/js/article-data.js": "/assets/js/article-data.js",
        "assets/js/dialogs.js": "/assets/js/dialogs.js",
        "assets/js/core-ui.js": "/assets/js/core-ui.js",
        "assets/js/sharing-and-tracking.js": "/assets/js/sharing-and-tracking.js",
        "assets/js/newsletter.js": "/assets/js/newsletter.js",
        "assets/js/comments.js": "/assets/js/comments.js",
        "assets/js/popular-content.js": "/assets/js/popular-content.js",
        "assets/js/reading-list.js": "/assets/js/reading-list.js",
        "assets/js/reading-progress.js": "/assets/js/reading-progress.js",
        "assets/js/search.js": "/assets/js/search.js",
        "assets/js/article-audio-player.js": "/assets/js/article-audio-player.js",
        "assets/js/audio-playlist.js": "/assets/js/audio-playlist.js",
        "assets/js/featured-photo.js": "/assets/js/featured-photo.js",
        "assets/js/main.js": "/assets/js/main.js",
        "assets/js/matomo.js": "/assets/js/matomo.js",
        "assets/js/nuevo-para-ti.js": "/assets/js/nuevo-para-ti.js",
        "assets/js/theme-toggle.js": "/assets/js/theme-toggle.js"
      };
    }
  });

  config.addFilter("date", (value, format = "d MMM yyyy") => {
    if (!value) {
      return "";
    }

    if (format === "rfc2822") {
      return new Date(value).toUTCString();
    }

    if (format === "dd/MM/yyyy") {
      return new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(new Date(value));
    }

    const normalizedFormat = String(format).trim();
    let options = {
      day: "2-digit",
      month: "short",
      year: "numeric"
    };

    if (normalizedFormat === "d MMMM yyyy") {
      options = {
        day: "numeric",
        month: "long",
        year: "numeric"
      };
    }

    const formatter = new Intl.DateTimeFormat("es-ES", options);

    return formatter.format(new Date(value));
  });

  config.addFilter("olderThanMonths", (value, months = 1) => {
    if (!value) {
      return false;
    }

    const articleDate = new Date(value);

    if (Number.isNaN(articleDate.getTime())) {
      return false;
    }

    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - Number(months));

    return articleDate < thresholdDate;
  });

  config.addFilter("absoluteUrl", (value, baseUrl = "") => {
    if (!value) {
      return "";
    }

    try {
      return new URL(String(value), String(baseUrl)).toString();
    } catch {
      return String(value);
    }
  });

  config.addFilter("relatedArticles", (items = [], currentArticle, limit = 5) => {
    if (!Array.isArray(items) || !currentArticle) {
      return [];
    }

    const currentTags = new Set((currentArticle.tags ?? []).map((tag) => tag.slug));

    return items
      .filter((candidate) => candidate?.id !== currentArticle.id)
      .map((candidate) => {
        const sharedTags = (candidate.tags ?? []).reduce((total, tag) => (
          currentTags.has(tag.slug) ? total + 1 : total
        ), 0);

        return {
          ...candidate,
          sharedTags
        };
      })
      .filter((candidate) => candidate.sharedTags > 0)
      .sort((a, b) => {
        if (b.sharedTags !== a.sharedTags) {
          return b.sharedTags - a.sharedTags;
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, limit);
  });

  config.addFilter("themeName", (value = "") => {
    const normalizedValue = String(value)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalizedValue) {
      return "";
    }

    return normalizedValue
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  });

  config.addFilter("articlesForTheme", (items = [], tagSlug = "") => {
    if (!Array.isArray(items) || !tagSlug) {
      return [];
    }

    return items.filter((item) =>
      (item.tags ?? []).some((tag) => tag.slug === tagSlug)
    );
  });

  config.addFilter("topThemes", (tags = [], limit = 6) => {
    if (!Array.isArray(tags)) {
      return [];
    }

    return [...tags]
      .sort((a, b) => {
        if ((b.count ?? 0) !== (a.count ?? 0)) {
          return (b.count ?? 0) - (a.count ?? 0);
        }

        return String(a.name ?? "").localeCompare(String(b.name ?? ""), "es");
      })
      .slice(0, limit);
  });

  config.addFilter("articlesForAuthor", (items = [], username = "") => {
    if (!Array.isArray(items) || !username) {
      return [];
    }

    return items.filter((item) => item?.author?.username === username);
  });

  config.addFilter("firstWithImage", (items = []) => {
    if (!Array.isArray(items)) {
      return null;
    }

    return items.find((item) => item?.image) || items[0] || null;
  });

  config.addFilter("excludeArticle", (items = [], articleId) => {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.filter((item) => item?.id !== articleId);
  });

  config.addFilter("feedItems", (items = []) => {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter((item) => item?.slug !== "acerca-de-la-categoria-plataforma-integracion-ferroviaria")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  config.addFilter("withAudio", (items = []) => {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.filter((item) => item?.audio?.sources?.length);
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "dist"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"]
  };
}
