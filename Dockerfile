FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN chown -R node:node /app

USER node

EXPOSE 8000

HEALTHCHECK --interval=30s \
            --timeout=5s \
            --start-period=30s \
            --retries=3 \
CMD wget --spider -q http://localhost:8000/api/v1/health || exit 1

CMD ["npm", "start"]