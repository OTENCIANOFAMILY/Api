import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import marketplaceRouter from "./routes/marketplace.js";
import { errorHandler, notFoundHandler } from "./utils/errors.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const origins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes("*") || origins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  }
}));
app.use(express.json({ limit: "50kb" }));
app.use(rateLimit({
  windowMs: positiveEnv("RATE_LIMIT_WINDOW_MS", 60000),
  limit: positiveEnv("RATE_LIMIT_MAX", 100),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "LOCAL_RATE_LIMITED",
      message: "Too many requests. Please try again shortly."
    }
  }
}));

app.get("/", (_req, res) => {
  res.json({
    name: "Roblox Marketplace API",
    version: "1.0.0",
    status: "running",
    documentation: "/api",
    health: "/health"
  });
});

app.get("/health", (_req, res) => {
  res.json({ success: true, status: "healthy" });
});

app.get("/api", (_req, res) => {
  res.json({
    success: true,
    endpoints: [
      { method: "GET", path: "/api/marketplace/search", description: "Search catalog items" },
      { method: "GET", path: "/api/marketplace/item/:id?itemType=Asset|Bundle", description: "Get one item" },
      { method: "GET", path: "/api/marketplace/items?ids=123,456&itemType=Asset", description: "Get multiple items" },
      { method: "GET", path: "/api/marketplace/thumbnail/:id", description: "Get an asset thumbnail" },
      { method: "GET", path: "/api/marketplace/categories", description: "Get catalog category metadata" },
      { method: "GET", path: "/api/marketplace/creator/:id?type=User|Group", description: "Search a creator catalog" }
    ]
  });
});

app.use("/api/marketplace", marketplaceRouter);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Roblox Marketplace API listening on http://localhost:${port}`);
});

function positiveEnv(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
