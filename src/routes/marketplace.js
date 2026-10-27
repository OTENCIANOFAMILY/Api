import { Router } from "express";
import {
  searchMarketplace,
  getItemDetails,
  getMultipleItemDetails,
  getMarketplaceCategories,
  getCreatorCatalog,
  getAssetThumbnail
} from "../services/roblox.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/errors.js";

const router = Router();

router.get("/search", asyncHandler(async (req, res) => {
  const result = await searchMarketplace(req.query);
  res.json({ success: true, ...result });
}));

router.get("/item/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "id");
  const itemType = parseItemType(req.query.itemType);
  const result = await getItemDetails([{ id, itemType }]);
  const item = result.data[0];
  if (!item) {
    res.status(404).json({
      success: false,
      error: { code: "ITEM_NOT_FOUND", message: "Roblox did not return details for this item.", upstreamErrors: result.errors }
    });
    return;
  }
  res.json({ success: true, data: item, upstreamErrors: result.errors });
}));

router.get("/items", asyncHandler(async (req, res) => {
  if (typeof req.query.ids !== "string" || !req.query.ids.trim()) {
    throw new ApiError(400, "INVALID_IDS", "Provide comma-separated IDs, for example ?ids=123,456.");
  }
  const rawIds = req.query.ids.split(",");
  if (rawIds.length > 100) {
    throw new ApiError(400, "TOO_MANY_IDS", "A maximum of 100 IDs is allowed per request.");
  }
  const items = rawIds.map((raw) => ({ id: parseId(raw.trim(), "ids"), itemType: parseItemType(req.query.itemType) }));
  const result = await getMultipleItemDetails(items);
  res.json({ success: true, ...result });
}));

router.get("/thumbnail/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "id");
  const data = await getAssetThumbnail(id);
  res.json({ success: true, data });
}));

router.get("/categories", asyncHandler(async (_req, res) => {
  const data = await getMarketplaceCategories();
  res.json({ success: true, data });
}));

router.get("/creator/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, "creator id");
  const type = req.query.type === undefined ? "User" : String(req.query.type);
  if (!["User", "Group"].includes(type)) {
    throw new ApiError(400, "INVALID_CREATOR_TYPE", "type must be User or Group.");
  }
  const result = await getCreatorCatalog(id, type, req.query);
  res.json({ success: true, ...result });
}));

function parseId(value, field) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError(400, "INVALID_ID", `${field} must be a positive integer.`);
  }
  return id;
}

function parseItemType(value) {
  const itemType = value === undefined ? "Asset" : String(value);
  if (!["Asset", "Bundle"].includes(itemType)) {
    throw new ApiError(400, "INVALID_ITEM_TYPE", "itemType must be Asset or Bundle.");
  }
  return itemType;
}

export default router;
