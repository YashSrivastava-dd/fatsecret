## FatSecret Express API (OAuth 2.0 client_credentials)

This project provides a comprehensive Express.js server that integrates the FatSecret Platform API using OAuth 2.0 client_credentials, token caching, and automatic refresh. 

### Available Endpoints

#### Food Endpoints
- `GET /foods?search=apple` → calls `foods.search`
- `GET /food/:id` → calls `food.get`

#### Recipe Endpoints
- `GET /recipes/search?search=pasta` → calls `recipes.search`
- `GET /recipes/trending` → calls `recipes.get` (trending/popular recipes)
- `GET /recipe/:id` → calls `recipe.get`

For detailed recipe API documentation, see [RECIPE_API_DOCS.md](./RECIPE_API_DOCS.md)

### Prerequisites
- Node.js 18+
- A FatSecret API application with Client ID and Client Secret

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create an environment file:
   - Copy `ENV.EXAMPLE` to `.env` and fill your credentials
   ```bash
   cp ENV.EXAMPLE .env
   ```
   - Set the following variables in `.env`:
     ```bash
     FATSECRET_CLIENT_ID=your_client_id_here
     FATSECRET_CLIENT_SECRET=your_client_secret_here
     # Optional
     PORT=3000
     ```

### Run
```bash
npm start
```

Server will start on `http://localhost:3000` (or `PORT` if provided).

### Usage Examples

#### Food APIs
- Search foods:
  ```bash
  curl "http://localhost:3000/foods?search=banana&limit=10&page=0"
  ```
- Get food by id:
  ```bash
  curl "http://localhost:3000/food/35755"
  ```

#### Recipe APIs
- Search recipes:
  ```bash
  curl "http://localhost:3000/recipes/search?search=pasta&limit=10&page=0"
  ```
- Search recipes with type filter:
  ```bash
  curl "http://localhost:3000/recipes/search?search=chicken&recipe_types=dinner"
  ```
- Get trending recipes:
  ```bash
  curl "http://localhost:3000/recipes/trending?limit=20"
  ```
- Get recipe by id:
  ```bash
  curl "http://localhost:3000/recipe/12345"
  ```

### Project structure
- `server.js` → Express setup and routes
- `fatsecret.js` → FatSecret OAuth2 logic, token caching, and API wrapper
- `.env` → Environment variables (created by you from `ENV.EXAMPLE`)
- `package.json` → ESM enabled (`"type": "module"`)

### Testing with Postman
Import `FatSecret-API.postman_collection.json` into Postman to test all endpoints. The collection includes:
- Health check
- OAuth token requests
- Food search and retrieval
- Recipe search (with filters)
- Recipe retrieval
- Trending recipes

Update the `base_url` variable to match your environment.

### Notes
- Access tokens are cached in-memory until expiry and refreshed automatically.
- Errors return JSON with `success: false` and a descriptive `error` message.
- All endpoints support pagination via `page` and `limit` parameters.
- Recipe searches can be filtered by recipe type (breakfast, lunch, dinner, dessert, etc.).


