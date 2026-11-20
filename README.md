# mayfly-sample-api

Minimal Node Testing app for Mayfly Docker PR previews.

- Listens on `$PORT` (default 3000)
- Runs as non-root (`USER node`)

## Local run

```powershell
node server.js
```

## Mayfly allow-list

```env
PREVIEW_RUNTIME=docker
PREVIEW_REPOS=meetamadhu/mayfly-sample-app,meetamadhu/mayfly-sample-api
```
