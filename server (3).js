const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

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

  console.log(req.method + " " + req.url);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle API proxy - match any POST to any URL containing "claude"
  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => proxyToClaude(body, res));
    return;
  }

  // Serve index.html for all GET requests
  const candidates = [
    path.join(__dirname, "index.html"),
    path.join(process.cwd(), "index.html"),
  ];

  let filePath = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { filePath = p; break; }
  }

  if (!filePath) {
    res.writeHead(500);
    res.end("index.html not found. __dirname=" + __dirname + " cwd=" + process.cwd());
    return;
  }

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end("Error: " + err.message);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("HAM app running on port " + PORT);
});
