# mayfly-sample-api

Minimal Node app for Mayfly Docker PR previews.
Testing1
- Listens on `$PORT` (default 3000)
- Runs as non-root (`USER node`)

## Local run
#new
```powershell
node server.js
```

## Mayfly allow-list

```env
PREVIEW_RUNTIME=docker
PREVIEW_REPOS=meetamadhu/mayfly-sample-app,meetamadhu/mayfly-sample-api
```
