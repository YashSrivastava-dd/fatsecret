## FatSecret Express API (OAuth 2.0 client_credentials)

This project provides a minimal Express.js server that integrates the FatSecret Platform API using OAuth 2.0 client_credentials, token caching, and automatic refresh. It exposes two endpoints:

- `GET /foods?search=apple` → calls `foods.search`
- `GET /food/:id` → calls `food.get`

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

### Usage
- Search foods:
  ```bash
  curl "http://localhost:3000/foods?search=banana"
  ```
- Get food by id:
  ```bash
  curl "http://localhost:3000/food/12345"
  ```

### Project structure
- `server.js` → Express setup and routes
- `fatsecret.js` → FatSecret OAuth2 logic, token caching, and API wrapper
- `.env` → Environment variables (created by you from `ENV.EXAMPLE`)
- `package.json` → ESM enabled (`"type": "module"`)

### Notes
- Access tokens are cached in-memory until expiry and refreshed automatically.
- Errors return JSON with `success: false` and a descriptive `error` message.


