import { IdAttributePlugin } from "@11ty/eleventy";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import markdownItAttrs from "markdown-it-attrs";
import markdownItFootnote from "markdown-it-footnote";
import tocPlugin from "eleventy-plugin-toc";
import yaml from "js-yaml";

export default async function (eleventyConfig) {
  eleventyConfig.setDataFileSuffixes([".11tydata"]);

  const metadata = yaml.load(readFileSync("./_data/metadata.yaml", "utf-8")) || {};
  const configuredSiteUrl = String(metadata.url || "").trim().replace(/\/+$/, "");
  const siteTimezone = String(metadata.timezone || "utc");
  const dateFormatCache = new Map();
  const postsCache = new WeakMap();
  const normalizeAuthor = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const getAuthorList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    const asString = String(value).trim();
    if (!asString) return [];
    if (asString.includes(",")) {
      return asString.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [asString];
  };
  const getPrimaryAuthor = (value) => getAuthorList(value)[0] || "";

  const getLatestCommitYear = () => {
    try {
      const latestCommitIso = execSync("git log -1 --format=%cI", {
        encoding: "utf8",
      }).trim();
      return new Intl.DateTimeFormat("en-US", { timeZone: siteTimezone, year: "numeric" }).format(new Date(latestCommitIso));
    } catch {
      return new Intl.DateTimeFormat("en-US", { timeZone: siteTimezone, year: "numeric" }).format(new Date());
    }
  };

  eleventyConfig.addGlobalData("latestCommitYear", getLatestCommitYear);

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // ponytail: tiny UTC token replacer covering only the tokens templates use
  // (yyyy/YYYY, MM, dd, MMMM/LLLL); extend if a template ever passes a new token.
  const formatDate = (dateObj, format) => {
    if (!dateObj) return "";
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    if (Number.isNaN(d.getTime())) return "";
    const cacheKey = `${d.getTime()}|${format}`;
    if (dateFormatCache.has(cacheKey)) {
      return dateFormatCache.get(cacheKey);
    }
    const formatted = format
      .replace(/yyyy|YYYY/g, String(d.getUTCFullYear()))
      .replace(/MMMM|LLLL/g, MONTHS[d.getUTCMonth()])
      .replace(/MM/g, String(d.getUTCMonth() + 1).padStart(2, "0"))
      .replace(/dd/g, String(d.getUTCDate()).padStart(2, "0"));
    dateFormatCache.set(cacheKey, formatted);
    return formatted;
  };

  eleventyConfig.addPlugin(tocPlugin);
  eleventyConfig.addPlugin(IdAttributePlugin);

  const md = markdownIt({ html: true, breaks: true, linkify: true, typographer: true })
    .use(markdownItAnchor, {
      permalink: markdownItAnchor.permalink.headerLink(),
      permalinkClass: "direct-link",
      permalinkSymbol: "#"
    })
    .use(markdownItAttrs)
    .use(markdownItFootnote);
  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addPassthroughCopy({ "public/css": "css" });
  eleventyConfig.addPassthroughCopy({ "public/images": "images" });
  eleventyConfig.addPassthroughCopy({ "public/docs": "docs" });
  eleventyConfig.addPassthroughCopy({ "public/site.webmanifest": "site.webmanifest" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/@zachleat/heading-anchors/heading-anchors.js": "js/heading-anchors.js"
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return formatDate(dateObj, "dd LLLL yyyy");
  });

  eleventyConfig.addFilter("date", (dateObj, format) => {
    return formatDate(dateObj, format);
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return formatDate(dateObj, "yyyy-MM-dd");
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    if (!dateObj) return "";
    const d = new Date(dateObj);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  });

  // Nunjucks' builtin trim uses /^\s*|\s*$/g which is quadratic on large
  // whitespace-heavy strings (53s of build time via firehose.njk); native trim is linear.
  eleventyConfig.addNunjucksFilter("trim", (value) => String(value ?? "").trim());

  eleventyConfig.addFilter("urlencode", (value) => {
    return encodeURIComponent(value);
  });

  eleventyConfig.addFilter("baseUrl", (url) => {
    const candidate = String(url || "").trim();
    if (!candidate || candidate === "/") {
      return configuredSiteUrl;
    }
    return candidate.endsWith("/") ? candidate.slice(0, -1) : candidate;
  });

  eleventyConfig.addFilter("absUrl", (path, base) => {
    try {
      return new URL(path, base).toString();
    } catch {
      return path;
    }
  });
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));
  eleventyConfig.addFilter("limit", (array, limit) => {
    return array.slice(0, limit);
  });

  eleventyConfig.addFilter("filterByCategory", (posts, category) => {
    return posts.filter((post) => {
      return post.data.categories && post.data.categories.includes(category);
    });
  });

  eleventyConfig.addFilter("filterByTag", (posts, tag) => {
    return posts.filter((post) => {
      return post.data.tags && post.data.tags.includes(tag);
    });
  });

  eleventyConfig.addFilter("filterByAuthor", (posts, author) => {
    const targetAuthor = normalizeAuthor(author);
    return posts.filter((post) => {
      const postAuthors = getAuthorList(post.data.author).map(normalizeAuthor);
      return postAuthors.includes(targetAuthor);
    });
  });
  eleventyConfig.addFilter("authorList", (author) => getAuthorList(author));
  eleventyConfig.addFilter("primaryAuthor", (author) => getPrimaryAuthor(author));
  eleventyConfig.addFilter("displayTerm", (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    return text
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  });
  eleventyConfig.addFilter("sortByDateDesc", (items = []) => {
    if (!Array.isArray(items)) return [];
    return [...items].sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addFilter("breadcrumbs", (dateObj, title, metadata) => {
    if (!dateObj || !title) return [];
    const yyyy = formatDate(dateObj, "yyyy");
    const MM = formatDate(dateObj, "MM");
    const dd = formatDate(dateObj, "dd");
    return [
      { text: metadata?.title || "The New Polis", url: "/" },
      { text: yyyy, url: `/${yyyy}/` },
      { text: formatDate(dateObj, "MMMM"), url: `/${yyyy}/${MM}/` },
      { text: dd, url: `/${yyyy}/${MM}/${dd}/` },
      { text: title, url: null },
    ];
  });

  const getPosts = (collectionApi) => {
    if (!postsCache.has(collectionApi)) {
      postsCache.set(collectionApi, collectionApi.getFilteredByGlob("content/posts/**/*.md").reverse());
    }
    return postsCache.get(collectionApi);
  };

  eleventyConfig.addCollection("posts", (collectionApi) => {
    return getPosts(collectionApi);
  });

  eleventyConfig.addCollection("conferences", (collectionApi) => {
    return collectionApi.getFilteredByGlob("content/conferences/**/*.md").reverse();
  });

  eleventyConfig.addCollection("categories", function (collectionApi) {
    let categories = new Set();
    getPosts(collectionApi).forEach((item) => {
      if (item.data.categories) {
        item.data.categories.forEach((cat) => categories.add(cat));
      }
    });
    return Array.from(categories).sort();
  });

  eleventyConfig.addCollection("tags", function (collectionApi) {
    let tags = new Set();
    getPosts(collectionApi).forEach((item) => {
      if (item.data.tags) {
        item.data.tags.forEach((tag) => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  });

  eleventyConfig.addCollection("authors", function (collectionApi) {
    const authors = new Set();
    getPosts(collectionApi).forEach((item) => {
      getAuthorList(item.data.author).forEach((author) => authors.add(author));
    });
    return Array.from(authors).sort();
  });

  eleventyConfig.addCollection("sitemapEntries", function (collectionApi) {
    const seenUrls = new Set();
    return collectionApi.getAll().filter((item) => {
      const url = item.url;
      if (!url || typeof url !== "string") return false;
      if (seenUrls.has(url)) return false;
      if (item.data?.eleventyExcludeFromCollections) return false;
      if (item.data?.permalink === false) return false;
      if (item.data?.sitemap === false) return false;
      seenUrls.add(url);
      return true;
    });
  });

  eleventyConfig.addPassthroughCopy({ "public/admin": "admin" });
  eleventyConfig.addCollection("authorPages", function (collectionApi) {
    const posts = getPosts(collectionApi);
    const authorDocs = collectionApi.getFilteredByGlob("content/authors/*.md");
    const profileByKey = new Map();
    const profileByName = new Map();
    const mergeProfile = (current = {}, incoming = {}) => {
      const merged = { ...current };
      Object.entries(incoming).forEach(([field, value]) => {
        if (value === undefined || value === null) return;
        if (typeof value === "string" && value.trim() === "") return;
        merged[field] = value;
      });
      return merged;
    };

    const upsertProfile = (rawKey, profile = {}) => {
      const normalizedKey = normalizeAuthor(rawKey || profile?.name || "");
      if (!normalizedKey) return;
      const nextProfile = {
        key: normalizedKey,
        name: profile?.name || rawKey,
        bio: profile?.bio,
        image: profile?.image,
        twitter: profile?.twitter,
        website: profile?.website,
        affiliation: profile?.affiliation,
      };
      const byKey = profileByKey.get(normalizedKey);
      const mergedByKey = mergeProfile(byKey, nextProfile);
      profileByKey.set(normalizedKey, mergedByKey);
      const normalizedName = normalizeAuthor(mergedByKey?.name || "");
      if (normalizedName) {
        const byName = profileByName.get(normalizedName);
        profileByName.set(normalizedName, mergeProfile(byName, mergedByKey));
      }
    };

    authorDocs.forEach((entry) => {
      const data = entry?.data || {};
      const keyCandidate = data.slug || data.author || data.title || entry.fileSlug;
      upsertProfile(keyCandidate, {
        name: data.author || data.title || keyCandidate,
        bio: data.bio,
        image: data.image,
        twitter: data.twitter,
        website: data.website,
        affiliation: data.affiliation || data.affilation,
      });
    });

    const authorPostMap = new Map();
    posts.forEach((post) => {
      getAuthorList(post.data.author).forEach((authorName) => {
        const normalizedAuthor = normalizeAuthor(authorName);
        if (!normalizedAuthor) return;
        if (!authorPostMap.has(normalizedAuthor)) {
          authorPostMap.set(normalizedAuthor, { name: authorName, posts: [] });
        }
        authorPostMap.get(normalizedAuthor).posts.push(post);
      });
    });

    const allAuthorKeys = new Set([
      ...Array.from(authorPostMap.keys()),
      ...Array.from(profileByKey.keys()),
    ]);

    return Array.from(allAuthorKeys)
      .map((normalizedAuthor) => {
        const data = authorPostMap.get(normalizedAuthor) || { name: "", posts: [] };
        const profile = profileByKey.get(normalizedAuthor) || profileByName.get(normalizedAuthor);
        const key = profile?.key || normalizedAuthor;
        return {
          key,
          name: profile?.name || data.name || key,
          bio: profile?.bio,
          image: profile?.image,
          twitter: profile?.twitter,
          website: profile?.website,
          affiliation: profile?.affiliation,
          posts: data.posts.sort((a, b) => b.date - a.date),
          url: `/authors/${key}/`,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

}

export const config = {
  dir: {
    input: "content",
    output: "_site",
    includes: "../_includes",
    data: "../_data",
  },
  markdownTemplateEngine: "njk",
  htmlTemplateEngine: "njk",
};
