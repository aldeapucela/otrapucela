import { readFileSync } from "node:fs";
import path from "node:path";

export default function eleventyConfig(config) {
  config.addPassthroughCopy({ "src/assets/favicon.ico": "favicon.ico" });
  config.addPassthroughCopy({ "src/assets/favicon.svg": "favicon.svg" });
  config.addPassthroughCopy({ "src/assets/logo-wordmark.svg": "assets/logo-wordmark.svg" });
  config.addPassthroughCopy({ "src/assets/social-preview.png": "assets/social-preview.png" });

  config.addWatchTarget("./src/assets/js");
  config.addWatchTarget("./src/assets/styles");

  config.addGlobalData("assetManifest", () => {
    const manifestPath = path.join(process.cwd(), "dist", "assets", "manifest.json");

    try {
      const fileContents = readFileSync(manifestPath, "utf8");
      return JSON.parse(fileContents);
    } catch {
      return {
        "assets/styles/main.css": "/assets/styles/main.css",
        "assets/js/main.js": "/assets/js/main.js",
        "assets/js/matomo.js": "/assets/js/matomo.js"
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
