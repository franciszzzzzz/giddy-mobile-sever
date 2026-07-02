# Giddy & Claire (Mobile + Server)

This repo contains:

- **client/**: React Native (Expo) mobile app
- **server/**: Node/Express API that integrates with **WordPress + WooCommerce**, Redis caching, Cloudinary uploads, and MongoDB.

---

## Folder structure

- `server/`
  - `server/server.js` - server entry point + dotenv loading
  - `server/app.js` - Express app setup (routes, middleware)
  - `server/config/`
    - `db.js` - MongoDB connection + WooCommerce/WP axios clients
    - `redis.js` - Redis client wrapper
    - `cloudinary.js` - Cloudinary configuration
  - `server/controllers/` - request handlers (auth, products, orders, etc.)
  - `server/routes/` - Express routes
  - `server/middleware/` - auth, rate limiting, error handling
  - `server/models/` - Mongoose models
  - `server/utils/` - integrations and helpers

- `client/`
  - `client/src/` - screens, components, services, state, etc.

---

## Server: required environment variables

The server loads env vars from:

- `server/config/.env`

Create that file and fill it with the following (minimum) variables.

### Core

- `PORT` - API port (default: `8000`)
- `NODE_ENV` - set to `development` locally (optional)

### MongoDB

- `MONGO_URI` - MongoDB connection string

### WordPress (WP) API

The server creates an axios client using:

- `WP_BASE_URL` - e.g. `https://your-domain.com`
- `WP_DEV_TOKEN` - value sent as `X-Dev-Server-Token`

Used endpoints (example seen in code):

- `POST /wp-json/jwt-auth/v1/token`

### WooCommerce (WC) API

The server creates an axios client using:

- `WC_BASE_URL` - e.g. `https://your-domain.com/wp-json/wc/v3`
- `WC_CONSUMER_KEY`
- `WC_CONSUMER_SECRET`
- `WP_DEV_TOKEN` - also used as `X-Dev-Server-Token`

Used endpoints (example seen in code):

- `POST /customers`
- `GET /customers?email=...`
- `PUT /customers/:id`

### Redis

The server uses `server/config/redis.js`.

- `REDIS_HOST` (default: `localhost`)
- `REDIS_PORT` (default: `6379`)
- `REDIS_USERNAME` (default: `default`)
- `REDIS_PASSWORD`

### JWT (for API auth)

Used in `server/middleware/userAuth.js`:

- `JWT_ACCESS_SECRET` - secret used to verify access tokens

(Refresh tokens are generated/stored, but the code shown uses this secret for verifying access tokens.)

### Cloudinary

Configured in `server/config/cloudinary.js`.

- `CLOUDINARY_NAME`
- `API_KEY`
- `API_SECRET`

---

## How to run (local)

### 1) Install dependencies

```bash
npm install
```

### 2) Configure env vars

Create:

- `server/config/.env`

### 3) Start the server

```bash
npm run dev
```

This runs `nodemon server/server.js`.

Server listens on:

- `http://localhost:8000` (or your configured `PORT`)

---

## Notes / troubleshooting

- Ensure your **WordPress JWT auth plugin/endpoint** is available at:
  - `${WP_BASE_URL}/wp-json/jwt-auth/v1/token`
- Ensure **WooCommerce REST API credentials** are correct (consumer key/secret).
- If Redis is unreachable, token/session flows will fail because the server reads/writes refresh tokens from Redis.
- If Cloudinary credentials are wrong, avatar upload/update flows will fail.

---

## Next improvements (recommended)

- Add a sample env file: `server/config/.env.example`
- Document API endpoints under `server/routes/` (or generate OpenAPI spec)
