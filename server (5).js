const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

async function proxyToClaude(body, res) {
  try {
    console.log("API_KEY present:", !!API_KEY, "length:", API_KEY ? API_KEY.length : 0);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: body
    });
    console.log("Anthropic status:", response.status);
    const text = await response.text();
    console.log("Anthropic response (first 200 chars):", text.substring(0, 200));
    res.writeHead(response.status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(text);
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

  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => proxyToClaude(body, res));
    return;
  }

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
  console.log("API key present:", !!API_KEY, "starts with:", API_KEY ? API_KEY.substring(0, 10) : "MISSING");

  // Keep-alive ping every 4 minutes so Render never spins down
  setInterval(() => {
    const options = {
      hostname: "hormonealignednutrition.onrender.com",
      port: 443,
      path: "/",
      method: "HEAD"
    };
    require("https").request(options, res => {
      console.log("Keep-alive ping:", res.statusCode);
    }).on("error", () => {}).end();
  }, 4 * 60 * 1000);
});
