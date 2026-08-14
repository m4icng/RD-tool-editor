import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Math.max(1, Number.parseInt(process.env.PORT || "4173", 10));
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp"
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  const requestedPath = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);

  if (!requestedPath.startsWith(`${root}${sep}`) || !existsSync(requestedPath) || !statSync(requestedPath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": mimeTypes[extname(requestedPath).toLowerCase()] || "application/octet-stream"
  });
  createReadStream(requestedPath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`RailwayDash editor: http://127.0.0.1:${port}`);
});
