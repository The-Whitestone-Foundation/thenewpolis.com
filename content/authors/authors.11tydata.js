export default {
  layout: "author-doc.njk",
  eleventyComputed: {
    permalink: (data) => {
      const raw = data.slug || data.author || data.title || data.page?.fileSlug || "";
      const key = String(raw)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return key ? `/authors/${key}/` : false;
    },
  },
};
