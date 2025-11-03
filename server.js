import express from "express";
import dotenv from "dotenv";
import { FatSecret } from "./fatsecret.js";

dotenv.config();

const app = express();
app.use(express.json());

// Initialize FatSecret client
const clientId = process.env.FATSECRET_CLIENT_ID;
const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
const fatsecret = new FatSecret({ clientId, clientSecret });

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// POST /auth/token → obtain OAuth2 access token (metadata by default)
app.post("/auth/token", async (req, res, next) => {
  try {
    const token = await fatsecret.getAccessToken();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = fatsecret.expiresAtEpoch || 0;
    const remaining = Math.max(0, expiresAt - now);

    const includeRaw = req.body?.raw === true || req.body?.raw === "1" || req.body?.raw === "true";
    res.json({
      success: true,
      token_type: "Bearer",
      expires_at_epoch: expiresAt,
      seconds_until_expiry: remaining,
      access_token: includeRaw ? token : undefined,
      access_token_preview: includeRaw ? undefined : `${token?.slice(0, 12) || ""}...(${(token || "").length} chars)`
    });
  } catch (err) {
    next(err);
  }
});

// Debug endpoint to verify env is loaded by the server process
app.get("/debug/env", (req, res) => {
  res.json({
    idLen: (process.env.FATSECRET_CLIENT_ID || "").length,
    secretLen: (process.env.FATSECRET_CLIENT_SECRET || "").length
  });
});

// GET /foods?search=apple&limit=10&page=0 → FatSecret foods.search
app.get("/foods", async (req, res, next) => {
  try {
    const query = (req.query.search || "").toString().trim();
    if (!query) {
      return res.status(400).json({ error: "Missing required query parameter: search" });
    }
    const limit = Number.isNaN(Number(req.query.limit)) ? 10 : Number(req.query.limit);
    const page = Number.isNaN(Number(req.query.page)) ? 0 : Number(req.query.page);

    const data = await fatsecret.searchFoods({ query, maxResults: limit, page });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /food/:id → FatSecret food.get
app.get("/food/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: "Missing required path parameter: id" });
    }
    const data = await fatsecret.getFoodById(id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ========== RECIPE ENDPOINTS ==========

// GET /recipes/search?search=pasta&limit=10&page=0&recipe_types=breakfast → FatSecret recipes.search
app.get("/recipes/search", async (req, res, next) => {
  try {
    const query = (req.query.search || "").toString().trim();
    if (!query) {
      return res.status(400).json({ error: "Missing required query parameter: search" });
    }
    const limit = Number.isNaN(Number(req.query.limit)) ? 10 : Number(req.query.limit);
    const page = Number.isNaN(Number(req.query.page)) ? 0 : Number(req.query.page);
    const recipeTypes = (req.query.recipe_types || "").toString().trim();

    const data = await fatsecret.searchRecipes({ query, maxResults: limit, page, recipeTypes });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /recipes/trending?limit=20&page=0&category=dinner → Get popular recipes
// Note: FatSecret doesn't have a dedicated trending endpoint, so this uses recipes.search
app.get("/recipes/trending", async (req, res, next) => {
  try {
    const limit = Number.isNaN(Number(req.query.limit)) ? 20 : Number(req.query.limit);
    const page = Number.isNaN(Number(req.query.page)) ? 0 : Number(req.query.page);
    const category = (req.query.category || "").toString().trim();

    const data = await fatsecret.getTrendingRecipes({ maxResults: limit, page, category });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /recipe/:id → FatSecret recipe.get
app.get("/recipe/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: "Missing required path parameter: id" });
    }
    const data = await fatsecret.getRecipeById(id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Global error handler
// Ensures consistent JSON errors
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err?.status || 500;
  const payload = {
    success: false,
    error: err?.message || "Internal Server Error"
  };
  if (err?.data) {
    payload.details = err.data;
  }
  res.status(status).json(payload);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});