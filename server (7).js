const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Simple file-based profile storage
const PROFILES_FILE = path.join(__dirname, "profiles.json");

function loadProfiles() {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      return JSON.parse(fs.readFileSync(PROFILES_FILE, "utf8"));
    }
  } catch(e) {}
  return {};
}

function saveProfiles(profiles) {
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
    return true;
  } catch(e) {
    console.error("Save profiles error:", e.message);
    return false;
  }
}

async function proxyToClaude(body, res) {
  try {
    console.log("API_KEY present:", !!API_KEY);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: body
    });
    const text = await response.text();
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

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  // ── Save profile ──────────────────────────────────────────────────────────
  if (req.method === "POST" && req.url === "/api/profile/save") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const { code, profile } = JSON.parse(body);
        if (!code || code.length < 3) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Code must be at least 3 characters." }));
          return;
        }
        const profiles = loadProfiles();
        profiles[code.toLowerCase()] = { ...profile, savedAt: new Date().toISOString() };
        saveProfiles(profiles);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch(e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Load profile ──────────────────────────────────────────────────────────
  if (req.method === "POST" && req.url === "/api/profile/load") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const { code } = JSON.parse(body);
        const profiles = loadProfiles();
        const profile = profiles[code.toLowerCase()];
        if (profile) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, profile }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "No profile found for that code." }));
        }
      } catch(e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Claude proxy ──────────────────────────────────────────────────────────
  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => proxyToClaude(body, res));
    return;
  }

  // ── Serve app ─────────────────────────────────────────────────────────────
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
    res.end("index.html not found. cwd=" + process.cwd());
    return;
  }
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) { res.writeHead(500); res.end("Error: " + err.message); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("HAM app running on port " + PORT);
  console.log("API key present:", !!API_KEY);
  setInterval(() => {
    require("https").request({
      hostname: "hormonealignednutrition.onrender.com",
      port: 443, path: "/", method: "HEAD"
    }, res => console.log("Keep-alive ping:", res.statusCode)).on("error", () => {}).end();
  }, 4 * 60 * 1000);
});
