FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY server.js ./

# Mayfly runs as uid 1000, read-only root, only /tmp writable
USER node
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
