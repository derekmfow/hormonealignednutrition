const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Try multiple possible locations for index.html
function findIndexHtml() {
  const candidates = [
    path.join(__dirname, "index.html"),
    path.join(process.cwd(), "index.html"),
    "/opt/render/project/src/index.html",
    path.join(__dirname, "..", "index.html"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log("Found index.html at:", p);
      return p;
    }
  }
  console.error("Could not find index.html. Tried:", candidates);
  return null;
}

async function proxyToClaude(body, res) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: body
    });
    const data = await response.json();
    res.writeHead(response.status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/claude") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => proxyToClaude(body, res));
    return;
  }

  const filePath = findIndexHtml();
  if (!filePath) {
    res.writeHead(500);
    res.end("index.html not found. __dirname=" + __dirname + " cwd=" + process.cwd());
    return;
  }

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Read error:", err.message);
      res.writeHead(500);
      res.end("Error reading file: " + err.message);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("HAM app running on port " + PORT);
  console.log("__dirname:", __dirname);
  console.log("cwd:", process.cwd());
  findIndexHtml();
});
