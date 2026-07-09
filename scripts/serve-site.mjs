import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("_site");
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "127.0.0.1";
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

function fileFor(url) {
  try {
    const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
    const candidate = normalize(join(root, pathname));
    if (!candidate.startsWith(root)) return null;
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return join(candidate, "index.html");
    return candidate;
  } catch {
    return null;
  }
}

createServer((req, res) => {
  const file = fileFor(req.url);
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}/`);
});
