import { ApiError } from "../utils/errors.js";

const CATALOG = "https://catalog.roblox.com";
const THUMBNAILS = "https://thumbnails.roblox.com";
const cache = new Map();
const CACHE_TTL_MS = Math.max(0, Number(process.env.CACHE_TTL_SECONDS ?? 45)) * 1000;
const TIMEOUT_MS = Math.max(1000, Number(process.env.ROBLOX_TIMEOUT_MS ?? 10000));

const SEARCH_PARAMS = [
  ["keyword", "Keyword", "string"],
  ["category", "Category", "integer"],
  ["subcategory", "Subcategory", "integer"],
  ["creatorType", "CreatorType", "integer"],
  ["creatorId", "CreatorTargetId", "integer"],
  ["creatorName", "CreatorName", "string"],
  ["minPrice", "MinPrice", "integer"],
  ["maxPrice", "MaxPrice", "integer"],
  ["sortType", "SortType", "integer"],
  ["sortAggregation", "SortAggregation", "integer"],
  ["limit", "Limit", "integer"],
  ["cursor", "Cursor", "string"]
];

export async function searchMarketplace(query = {}) {
  const params = new URLSearchParams();

  for (const [inputName, upstreamName, kind] of SEARCH_PARAMS) {
    const value = query[inputName] ?? query[upstreamName];
    if (value === undefined || value === "") continue;
    if (Array.isArray(value) || typeof value === "object") {
      throw new ApiError(400, "INVALID_PARAMETER", `${inputName} must be a single value.`);
    }
    if (kind === "string") {
      const stringValue = String(value).trim();
      const maxLength = inputName === "cursor" ? 1000 : 100;
      if (!stringValue || stringValue.length > maxLength) {
        throw new ApiError(400, "INVALID_PARAMETER", `${inputName} must be a non-empty string of at most ${maxLength} characters.`);
      }
      params.set(upstreamName, stringValue);
    } else {
      const number = Number(value);
      if (!Number.isSafeInteger(number) || number < 0) {
        throw new ApiError(400, "INVALID_PARAMETER", `${inputName} must be a non-negative integer.`);
      }
      params.set(upstreamName, String(number));
    }
  }

  const creatorType = params.get("CreatorType");
  const creatorId = params.get("CreatorTargetId");
  if ((creatorType === null) !== (creatorId === null)) {
    throw new ApiError(400, "CREATOR_FILTER_REQUIRED", "creatorType and creatorId must be supplied together.");
  }
  if (params.has("MinPrice") && params.has("MaxPrice") &&
      Number(params.get("MinPrice")) > Number(params.get("MaxPrice"))) {
    throw new ApiError(400, "INVALID_PRICE_RANGE", "minPrice cannot exceed maxPrice.");
  }
  if (params.has("Limit") && ![10, 28, 30].includes(Number(params.get("Limit")))) {
    throw new ApiError(400, "INVALID_LIMIT", "limit must be 10, 28, or 30.");
  }

  const payload = await robloxFetch(`${CATALOG}/v1/search/items/details?${params.toString()}`);
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const thumbnailMap = await getAssetThumbnails(rows.map((item) => Number(item.id)).filter(Number.isSafeInteger));

  return {
    keyword: payload.keyword ?? query.keyword ?? null,
    pagination: {
      previousCursor: payload.previousPageCursor ?? null,
      nextCursor: payload.nextPageCursor ?? null
    },
    data: rows.map((item) => normalizeSearchItem(item, thumbnailMap.get(Number(item.id))))
  };
}

export async function getItemDetails(items) {
  const payload = await robloxFetch(`${CATALOG}/v1/catalog/items/details`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items })
  });
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const thumbnailMap = await getAssetThumbnails(
    rows.filter((item) => (item.itemType ?? "Asset") === "Asset")
      .map((item) => Number(item.id ?? item.itemId))
      .filter(Number.isSafeInteger)
  );

  return {
    data: rows.map((item) => {
      const id = Number(item.id ?? item.itemId);
      const itemType = item.itemType ?? items.find((entry) => entry.id === id)?.itemType ?? "Asset";
      return {
        ...item,
        id: item.id ?? item.itemId ?? null,
        itemType,
        thumbnailUrl: itemType === "Asset" ? thumbnailMap.get(id) ?? null : null,
        catalogUrl: id ? `https://www.roblox.com/${itemType === "Bundle" ? "bundles" : "catalog"}/${id}` : null
      };
    }),
    errors: Array.isArray(payload.errors) ? payload.errors : []
  };
}

export async function getMultipleItemDetails(items) {
  const results = [];
  const errors = [];
  for (let i = 0; i < items.length; i += 50) {
    const result = await getItemDetails(items.slice(i, i + 50));
    results.push(...result.data);
    errors.push(...result.errors);
  }
  return { data: results, errors };
}

export async function getMarketplaceCategories() {
  const [categories, subcategories] = await Promise.all([
    robloxFetch(`${CATALOG}/v1/categories`),
    robloxFetch(`${CATALOG}/v1/subcategories`)
  ]);
  return { categories, subcategories };
}

export async function getCreatorCatalog(id, type, query) {
  const forwarded = { ...query, creatorId: String(id), creatorType: type === "User" ? "1" : "2" };
  delete forwarded.type;
  return searchMarketplace(forwarded);
}

export async function getAssetThumbnail(id) {
  const result = await getAssetThumbnails([id]);
  return result.get(id) ? [{ targetId: id, imageUrl: result.get(id) }] : [];
}

async function getAssetThumbnails(ids) {
  const unique = [...new Set(ids)];
  const output = new Map();
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const params = new URLSearchParams({
      assetIds: chunk.join(","),
      size: "150x150",
      format: "Png",
      isCircular: "false"
    });
    try {
      const payload = await robloxFetch(`${THUMBNAILS}/v1/assets?${params.toString()}`);
      for (const item of payload.data ?? []) {
        if (item.targetId && item.imageUrl) output.set(Number(item.targetId), item.imageUrl);
      }
    } catch (error) {
      if (error.status === 429) throw error;
    }
  }
  return output;
}

function normalizeSearchItem(item, thumbnailUrl) {
  return {
    id: item.id ?? null,
    itemType: item.itemType ?? null,
    assetType: item.assetType ?? null,
    bundleType: item.bundleType ?? null,
    name: item.name ?? null,
    description: item.description ?? null,
    creator: {
      type: item.creatorType ?? null,
      id: item.creatorTargetId ?? null,
      name: item.creatorName ?? null
    },
    price: item.price ?? null,
    lowestResellerPrice: item.lowestPrice ?? null,
    priceStatus: item.priceStatus ?? null,
    itemStatus: item.itemStatus ?? [],
    itemRestrictions: item.itemRestrictions ?? [],
    isForSale: Array.isArray(item.itemStatus)
      ? item.itemStatus.includes("Sale")
      : item.price !== undefined && item.price !== null,
    favoriteCount: item.favoriteCount ?? null,
    purchaseCount: item.purchaseCount ?? null,
    unitsAvailable: item.unitsAvailableForConsumption ?? null,
    thumbnailUrl: thumbnailUrl ?? null,
    catalogUrl: item.id
      ? `https://www.roblox.com/${item.itemType === "Bundle" ? "bundles" : "catalog"}/${item.id}`
      : null
  };
}

async function robloxFetch(url, options = {}) {
  const method = options.method ?? "GET";
  const cacheKey = `${method}:${url}:${options.body ?? ""}`;
  if (method === "GET" && CACHE_TTL_MS > 0) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (cached) cache.delete(cacheKey);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "RobloxMarketplaceExplorer/1.0",
        ...(options.headers ?? {})
      }
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError(504, "ROBLOX_TIMEOUT", "Roblox did not respond before the timeout.");
    }
    throw new ApiError(502, "ROBLOX_UNREACHABLE", "Could not connect to Roblox services.");
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(502, "INVALID_UPSTREAM_RESPONSE", "Roblox returned a response that was not valid JSON.");
  }

  if (!response.ok) {
    const status = response.status === 429 ? 503 : 502;
    throw new ApiError(
      status,
      response.status === 429 ? "ROBLOX_RATE_LIMITED" : "ROBLOX_API_ERROR",
      `Roblox returned HTTP ${response.status}.`,
      { upstreamStatus: response.status, upstreamMessage: payload?.errors?.[0]?.message ?? payload?.message ?? null }
    );
  }

  if (method === "GET" && CACHE_TTL_MS > 0) {
    cache.set(cacheKey, { value: payload, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return payload;
}
