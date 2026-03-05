import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function parsePort(argv) {
  const idx = argv.findIndex((item) => item === "--port" || item === "-p");
  if (idx >= 0 && argv[idx + 1]) {
    const p = Number(argv[idx + 1]);
    if (Number.isFinite(p) && p > 0 && p < 65536) {
      return p;
    }
  }
  const envPort = Number(process.env.PORT ?? 5173);
  if (Number.isFinite(envPort) && envPort > 0 && envPort < 65536) {
    return envPort;
  }
  return 5173;
}

const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function resolveFilePath(urlPath) {
  let pathname = decodeURIComponent(String(urlPath ?? "/").split("?")[0]);
  if (!pathname || pathname === "/") {
    pathname = "/index.html";
  }

  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.resolve(projectRoot, `.${normalized}`);
  if (!filePath.startsWith(projectRoot)) {
    return null;
  }
  return filePath;
}

const port = parsePort(process.argv.slice(2));

const server = http.createServer((req, res) => {
  const method = req.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    send(res, 405, "Method Not Allowed", {
      "Content-Type": "text/plain; charset=utf-8"
    });
    return;
  }

  const filePath = resolveFilePath(req.url ?? "/");
  if (!filePath) {
    send(res, 400, "Bad Request", {
      "Content-Type": "text/plain; charset=utf-8"
    });
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      send(res, 404, "Not Found", {
        "Content-Type": "text/plain; charset=utf-8"
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Cache-Control": "no-cache"
    };

    if (method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      send(res, 500, "Internal Server Error", {
        "Content-Type": "text/plain; charset=utf-8"
      });
    });
    res.writeHead(200, headers);
    stream.pipe(res);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[money-one-liner-static] http://127.0.0.1:${port}/index.html`);
});
