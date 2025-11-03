import axios from "axios";

const OAUTH_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const API_BASE_URL = "https://platform.fatsecret.com/rest/server.api";

// Small buffer to refresh a little before actual expiry
const EXPIRY_BUFFER_SECONDS = 60;

export class FatSecret {
  constructor({ clientId, clientSecret }) {
    if (!clientId || !clientSecret) {
      throw new Error("FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET are required");
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.expiresAtEpoch = 0; // epoch seconds

    this.http = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000
    });
  }

  // Returns a valid access token, refreshing if necessary
  async getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && now < this.expiresAtEpoch - EXPIRY_BUFFER_SECONDS) {
      return this.accessToken;
    }
    const token = await this.requestNewAccessToken();
    this.accessToken = token.access_token;
    // expires_in is seconds from now
    this.expiresAtEpoch = now + (token.expires_in || 0);
    return this.accessToken;
  }

  async requestNewAccessToken() {
    const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    try {
      const response = await axios.post(
        OAUTH_TOKEN_URL,
        new URLSearchParams({
          grant_type: "client_credentials",
          scope: "basic"
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${creds}`
          },
          timeout: 15000
        }
      );
      return response.data;
    } catch (err) {
      throw this.normalizeAxiosError(err, "Failed to obtain access token");
    }
  }

  // Generic FatSecret API request helper
  async request(method, params = {}) {
    const token = await this.getAccessToken();
    const searchParams = new URLSearchParams({
      method,
      format: "json",
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, v == null ? "" : String(v)])
      )
    });

    try {
      const response = await this.http.get("", {
        headers: { Authorization: `Bearer ${token}` },
        params: searchParams
      });
      return response.data;
    } catch (err) {
      // If unauthorized, try one silent refresh and retry once
      if (err?.response?.status === 401) {
        try {
          this.accessToken = null;
          await this.getAccessToken();
          const retry = await this.http.get("", {
            headers: { Authorization: `Bearer ${this.accessToken}` },
            params: searchParams
          });
          return retry.data;
        } catch (retryErr) {
          throw this.normalizeAxiosError(retryErr, `FatSecret request failed for method ${method}`);
        }
      }
      throw this.normalizeAxiosError(err, `FatSecret request failed for method ${method}`);
    }
  }

  // foods.search → search_expression, max_results, page_number, etc.
  async searchFoods({ query, maxResults = 10, page = 0 }) {
    const params = {
      search_expression: query,
      max_results: maxResults,
      page_number: page
    };
    return await this.request("foods.search", params);
  }

  // food.get → food_id
  async getFoodById(foodId) {
    return await this.request("food.get", { food_id: foodId });
  }

  // ========== RECIPE METHODS ==========

  // recipes.search → search_expression, max_results, page_number, recipe_types
  async searchRecipes({ query, maxResults = 10, page = 0, recipeTypes = "" }) {
    const params = {
      search_expression: query,
      max_results: maxResults,
      page_number: page
    };
    if (recipeTypes) {
      params.recipe_types = recipeTypes;
    }
    return await this.request("recipes.search", params);
  }

  // recipe.get → recipe_id
  async getRecipeById(recipeId) {
    return await this.request("recipe.get", { recipe_id: recipeId });
  }

  // Get popular recipes by searching with common/popular search terms
  // Note: FatSecret API doesn't have a dedicated "trending" endpoint
  // This uses recipes.search with popular terms as a workaround
  async getTrendingRecipes({ maxResults = 20, page = 0, category = "" } = {}) {
    const params = {
      search_expression: category || "popular",
      max_results: maxResults,
      page_number: page
    };
    return await this.request("recipes.search", params);
  }

  normalizeAxiosError(err, message) {
    const status = err?.response?.status;
    const statusText = err?.response?.statusText;
    const data = err?.response?.data;
    const detail = data?.error_description || data?.message || data?.error || err?.message;
    const wrapped = new Error(`${message}${status ? ` (HTTP ${status}${statusText ? ` ${statusText}` : ""})` : ""}: ${detail}`);
    wrapped.status = status || 500;
    wrapped.data = data;
    return wrapped;
  }
}

export default FatSecret;


