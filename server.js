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
    console.error("Proxy error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  console.log(req.method, req.url);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // API proxy — match any URL containing "claude"
  if (req.url.includes("claude") && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => proxyToClaude(body, res));
    return;
  }

  if (req.url.includes("claude") && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed — use POST");
    return;
  }

  // Serve index.html for everything else
  const filePath = path.resolve(__dirname, "index.html");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("File read error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Error loading app: " + err.message);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HAM app running on port ${PORT}`);
});
