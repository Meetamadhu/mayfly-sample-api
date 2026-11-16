import http from "node:http";

const port = Number(process.env.PORT) || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<html>
  <head><title>Mayfly sample</title></head>
  <body>
    <h1>mayfly-sample-api</h1>
    <p>Path: ${req.url}</p>
    <p>Commit preview is running.</p>
  </body>
</html>`);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`listening on ${port}`);
});
