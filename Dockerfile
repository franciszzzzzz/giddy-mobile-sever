
FROM node:22.23.4-alpine3.24

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN chown -R node:node /app

USER node

EXPOSE 8000

# 12h interval: this only feeds `docker ps` health status.
HEALTHCHECK --interval=12h \
            --timeout=5s \
            --start-period=30s \
            --retries=3 \
CMD wget --spider -q http://localhost:8000/api/v1/health || exit 1

CMD ["npm", "start"]
