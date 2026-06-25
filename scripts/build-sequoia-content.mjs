import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content");
const OUT_DIR = path.join(ROOT, ".sequoia", "content");
const SITE_NAME = "The New Polis";
const INCLUDE_PREFIXES = ["posts/"];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function parseFrontMatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { data: {}, body: source };
  const data = {};
  let currentList = null;
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\t/g, "  ");
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && currentList) {
      data[currentList].push(cleanScalar(listItem[1]));
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    if (rawValue === "") {
      data[key] = [];
      currentList = key;
      continue;
    }
    if (rawValue === "|" || rawValue === ">") {
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1].trim() === "")) {
        i += 1;
        block.push(lines[i].trim());
      }
      data[key] = cleanScalar(block.join(rawValue === ">" ? " " : "\n"));
      currentList = null;
      continue;
    }
    currentList = null;
    data[key] = cleanScalar(rawValue);
  }
  return { data, body: source.slice(match[0].length) };
}

function cleanScalar(value) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function slugify(value) {
  return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function yamlString(value) {
  return JSON.stringify(String(value || ""));
}

function listValue(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function outputPathFor(filePath, data) {
  if (typeof data.permalink === "string" && data.permalink.startsWith("/")) return data.permalink;
  const rel = path.relative(CONTENT_DIR, filePath).split(path.sep).join("/");
  return `/${rel.replace(/\.md$/, "").replace(/\/index$/, "")}/`;
}

function writeRecord(filePath) {
  const rel = path.relative(CONTENT_DIR, filePath).split(path.sep).join("/");
  if (!INCLUDE_PREFIXES.some((prefix) => rel.startsWith(prefix))) return false;
  const source = fs.readFileSync(filePath, "utf8");
  const { data, body } = parseFrontMatter(source);
  if (data.draft === "true" || data.published === "false") return false;
  const standardPath = outputPathFor(filePath, data);
  const title = data.title || path.basename(filePath, ".md");
  const tags = [...new Set([...listValue(data.tags), ...listValue(data.categories)])];
  const outName = `${slugify(standardPath) || slugify(title)}.md`;
  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    `description: ${yamlString(data.description || "")}`,
    `date: ${yamlString(data.date || "2018-01-01")}`,
    `standardPath: ${yamlString(standardPath)}`,
    `publicationName: ${yamlString(SITE_NAME)}`,
    tags.length ? `tags: [${tags.map(yamlString).join(", ")}]` : "",
    "draft: false",
    "---",
    "",
  ].filter(Boolean).join("\n");
  fs.writeFileSync(path.join(OUT_DIR, outName), `${frontmatter}
${body.trim()}\n`);
  return true;
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const filePath of walk(CONTENT_DIR)) {
  if (writeRecord(filePath)) count += 1;
}
console.log(`[sequoia] staged ${count} documents in ${path.relative(ROOT, OUT_DIR)}`);
