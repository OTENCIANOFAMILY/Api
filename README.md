# Roblox Marketplace API

Node.js REST API for searching publicly accessible Roblox avatar Marketplace catalog items and retrieving item details and asset thumbnails.

**Important:** Roblox may change or restrict endpoints. This project does not require a Roblox password or `.ROBLOSECURITY` cookie. It targets avatar catalog items, not the separate Creator Store for Studio models, plugins, audio, and other creator assets.

## Requirements

- Windows 10/11
- Node.js 20+
- VS Code (recommended)

## Run on Windows

1. Install Node.js LTS from https://nodejs.org/.
2. Extract this project ZIP.
3. Open the extracted folder in VS Code.
4. Select **Terminal → New Terminal**.
5. Install dependencies:

   ```powershell
   npm install
   ```

6. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

7. Start the API:

   ```powershell
   npm start
   ```

8. Open `http://localhost:3000/health`. A healthy response looks like:

   ```json
   {"success":true,"status":"healthy"}
   ```

For automatic restart while developing, run `npm run dev`. Run tests with `npm test`.

## Endpoints

### Search

`GET /api/marketplace/search`

Examples:

- `http://localhost:3000/api/marketplace/search?keyword=hair`
- `http://localhost:3000/api/marketplace/search?keyword=hair&limit=10`
- `http://localhost:3000/api/marketplace/search?minPrice=0&maxPrice=100&sortType=4`
- `http://localhost:3000/api/marketplace/search?creatorType=1&creatorId=1`

The route forwards supported query parameters to Roblox's catalog search endpoint. Use `pagination.nextCursor` as `cursor` on the next request and keep the rest of your filters unchanged. Roblox may reject combinations or values it does not support.

### One item

`GET /api/marketplace/item/:id?itemType=Asset`

Example:

`http://localhost:3000/api/marketplace/item/527373900`

For a bundle, use `?itemType=Bundle`. Asset and bundle IDs are not interchangeable. Roblox's catalog details endpoint can change, and this API returns the upstream fields rather than assuming every field exists.

### Multiple items

`GET /api/marketplace/items?ids=527373900,123456789&itemType=Asset`

Maximum 100 IDs per request. Use a separate request for bundles.

### Thumbnail

`GET /api/marketplace/thumbnail/:id`

Example:

`http://localhost:3000/api/marketplace/thumbnail/527373900`

### Categories

`GET /api/marketplace/categories`

Fetches catalog category and subcategory metadata from Roblox.

### Creator catalog

`GET /api/marketplace/creator/1?type=User`

Use `type=Group` for a group creator where supported. This endpoint uses Roblox catalog search creator filters.

### Endpoint list

`GET /api`

### Health check

`GET /health`

## Roblox endpoints used

- `GET https://catalog.roblox.com/v1/search/items/details`
- `POST https://catalog.roblox.com/v1/catalog/items/details`
- `GET https://catalog.roblox.com/v1/categories`
- `GET https://catalog.roblox.com/v1/subcategories`
- `GET https://thumbnails.roblox.com/v1/assets`

Official documentation starting points:

- https://create.roblox.com/docs/cloud/reference/domains/catalog
- https://create.roblox.com/docs/projects/assets/api
- https://create.roblox.com/docs/cloud/reference/features/assets

The catalog item-details endpoint may be experimental or subject to change. Verify current endpoint behavior against Roblox's documentation and live responses before public production use. This repository does not claim a live endpoint test has been performed in your environment.

## Environment

Copy `.env.example` to `.env`.

- `PORT`: server port (default 3000)
- `NODE_ENV`: use `production` for production mode
- `CORS_ORIGIN`: comma-separated allowed frontend origins; `*` is convenient for local testing only
- `ROBLOX_TIMEOUT_MS`: upstream timeout
- `CACHE_TTL_SECONDS`: GET response cache lifetime
- `RATE_LIMIT_WINDOW_MS`: local rate limit window
- `RATE_LIMIT_MAX`: maximum requests per window

## Publishing / deployment

Before deploying publicly:

1. Set `NODE_ENV=production`.
2. Set `CORS_ORIGIN` to your real frontend domain(s), not `*`.
3. Use a host that supports Node.js 20 or newer.
4. Set the port using the host-provided `PORT` environment variable.
5. Check the host's proxy requirements before enabling `TRUST_PROXY`.
6. Monitor upstream 429 and 5xx responses.
7. Review Roblox's terms and current API documentation.

The included in-memory cache and rate limiter are per-process. For a multi-instance deployment, use a shared cache and rate-limit store. Do not expose stack traces or secrets to clients.

## Error behavior

- `400`: invalid input
- `404`: unknown route or item not returned
- `502`: upstream request or response failure
- `503`: Roblox rate-limited this API
- `504`: upstream timeout
- `500`: unexpected local error

An upstream failure is returned as an error rather than being disguised as an empty search result.
