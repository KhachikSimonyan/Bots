const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const assets = new Set([
  "/index.html", "/src/styles.css", "/src/app.js", "/src/export.js",
  "/src/sync.js", "/src/reminder-time.js", "/src/debt-plan.js", "/src/finance-tools.js",
]);
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

function createPreview() {
  return http.createServer((request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(request.url.split("?")[0]);
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }
    if (pathname === "/") pathname = "/index.html";
    if (!assets.has(pathname)) {
      response.writeHead(404).end("Not found");
      return;
    }
    fs.readFile(path.join(__dirname, pathname), (error, data) => {
      if (error) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": types[path.extname(pathname)] + "; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : data);
    });
  });
}

module.exports = { createPreview };
if (require.main === module) {
  const port = Number(process.env.PORT || 4174);
  createPreview().listen(port, "127.0.0.1", () => console.log(`Preview: http://127.0.0.1:${port}`));
}
