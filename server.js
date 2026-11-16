import http from "node:http";

// mayfly-sample-api: a tiny JSON API that Mayfly builds and runs for every pull request.
// Notes live in memory only (Mayfly's containers have a read-only filesystem), so they reset
// whenever the preview sleeps or a new commit is built.

const port = Number(process.env.PORT) || 3000;
const startedAt = new Date();
const info = {
  service: "mayfly-sample-api",
  repository: process.env.PREVIEW_REPOSITORY || "meetamadhu/mayfly-sample-api",
  pullRequest: process.env.PREVIEW_PR ? Number(process.env.PREVIEW_PR) : null,
  branch: process.env.PREVIEW_BRANCH || "unknown",
  commit: process.env.PREVIEW_SHA || "unknown",
};

const MAX_NOTES = 50;
const MAX_NOTE_LENGTH = 200;
const notes = [
  { id: 1, text: "Hello from this pull request's own preview.", createdAt: startedAt.toISOString() },
];
let nextId = 2;

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      // Over the limit: keep reading but drop the data, so the client still gets a 413 answer.
      if (size <= limit) chunks.push(chunk);
    });
    req.on("end", () => {
      if (size > limit) reject(Object.assign(new Error("Body too large"), { status: 413 }));
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

// Links work both directly and behind Mayfly's /p/<owner>/<name>/<pr>/ prefix: they're relative.
const page = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sample API · PR #${esc(info.pullRequest ?? "?")}</title>
<script>
// Behind Mayfly the page may be opened as …/1 (no trailing slash); add it so "api/…" links resolve inside this preview.
if (!location.pathname.endsWith("/")) history.replaceState(null, "", location.pathname + "/" + location.search);
</script>
<style>
:root{color-scheme:dark;--bg:#0a1412;--surface:#11221f;--panel:#152a26;--ink:#e6f2ee;--muted:#9bb3ac;--line:#243f39;--mint:#3dd6a5;--code:#0d1c19}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;padding:1.5rem 1rem 2.5rem;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,"Segoe UI",sans-serif;display:grid;justify-items:center;align-content:start;gap:1rem}
.card{width:min(42rem,100%);border:1px solid color-mix(in srgb,var(--mint) 30%,var(--line));border-radius:16px;background:var(--surface);overflow:hidden}
.band{padding:1rem 1.25rem;background:linear-gradient(135deg,#0f8f6b,#0b6b52);color:#fff}
.band p{margin:0;color:#fff}.eyebrow{font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.body{padding:1.25rem}
h1{margin:0;font-size:1.5rem;letter-spacing:-.02em}
h2{margin:1.4rem 0 .6rem;font-size:1rem}
p{color:var(--muted);margin:.4rem 0 0}
dl{display:grid;grid-template-columns:8rem 1fr;gap:.4rem .75rem;margin:1rem 0 0}
dt{color:var(--muted);font-size:.9rem}
dd{margin:0;font-family:ui-monospace,monospace;font-size:.9rem;word-break:break-all}
ul{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}
li{display:flex;gap:.75rem;align-items:baseline;padding:.6rem .75rem;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
.verb{flex:none;min-width:3.4rem;font:700 .75rem ui-monospace,monospace;color:var(--mint)}
a{color:var(--mint)}
code{font-family:ui-monospace,monospace;background:var(--code);padding:.1rem .4rem;border-radius:6px}
pre{margin:.6rem 0 0;padding:.75rem;border-radius:10px;background:var(--code);overflow-x:auto;font-size:.85rem}
</style>
</head>
<body>
<main class="card">
<div class="band"><p class="eyebrow">Live PR preview · API</p><p>Built from this pull request's own code, in its own container.</p></div>
<div class="body">
<h1>mayfly-sample-api</h1>
<p>A small JSON API. Every pull request gets its own running copy.</p>
<dl>
<dt>Repository</dt><dd>${esc(info.repository)}</dd>
<dt>Pull request</dt><dd>#${esc(info.pullRequest ?? "?")}</dd>
<dt>Branch</dt><dd>${esc(info.branch)}</dd>
<dt>Commit</dt><dd>${esc(info.commit)}</dd>
<dt>Started</dt><dd>${esc(startedAt.toISOString())}</dd>
</dl>
<h2>Endpoints</h2>
<ul>
<li><span class="verb">GET</span><span><a href="api/health">api/health</a> — is the service up</span></li>
<li><span class="verb">GET</span><span><a href="api/info">api/info</a> — repo, PR, branch, commit, uptime</span></li>
<li><span class="verb">GET</span><span><a href="api/notes">api/notes</a> — list notes (${notes.length} now)</span></li>
<li><span class="verb">POST</span><span><code>api/notes</code> — add a note: <code>{"text":"..."}</code></span></li>
</ul>
<pre>curl -X POST &lt;this preview URL&gt;/api/notes \\
  -H "content-type: application/json" \\
  -d '{"text":"Reviewed on this PR"}'</pre>
</div>
</main>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname.replace(/\/+$/, "") || "/";

  try {
    if (req.method === "GET" && path === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(page());
      return;
    }
    if (req.method === "GET" && path === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === "GET" && path === "/api/info") {
      sendJson(res, 200, { ...info, startedAt: startedAt.toISOString(), uptimeSeconds: Math.round(process.uptime()) });
      return;
    }
    if (path === "/api/notes") {
      if (req.method === "GET") {
        sendJson(res, 200, { notes });
        return;
      }
      if (req.method === "POST") {
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch (error) {
          if (error.status === 413) throw error;
          sendJson(res, 400, { error: "Send JSON like {\"text\":\"...\"}." });
          return;
        }
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text || text.length > MAX_NOTE_LENGTH) {
          sendJson(res, 400, { error: `"text" must be 1–${MAX_NOTE_LENGTH} characters.` });
          return;
        }
        const note = { id: nextId++, text, createdAt: new Date().toISOString() };
        notes.push(note);
        if (notes.length > MAX_NOTES) notes.shift();
        sendJson(res, 201, { note });
        return;
      }
      res.setHeader("allow", "GET, POST");
      sendJson(res, 405, { error: "Use GET or POST." });
      return;
    }
    sendJson(res, 404, { error: "Not found", path });
  } catch (error) {
    sendJson(res, error.status === 413 ? 413 : 500, { error: error.status === 413 ? "Body too large." : "Internal error." });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`mayfly-sample-api listening on ${port}`);
});
